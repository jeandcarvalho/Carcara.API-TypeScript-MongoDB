"use strict";
// src/services/SearchBigService.ts
// Busca em big_1hz com filtros do front (Search.tsx)
// Estratégia atual:
//  - 1º pipeline Mongo: filtra TODOS os segundos que batem (sem links).
//  - Ordena e pagina por acq_id no Node.
//  - Para os acq_ids da página, escolhe até N segundos representativos.
//  - 2º pipeline Mongo: busca links SOMENTE desses segundos (por acq_id/sec).
//  - Anexa links apenas nesses poucos segundos; os demais vêm com links = [].
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchBigService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
/* ================= Helpers ================= */
function splitList(v) {
    if (!v)
        return [];
    return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}
function parseRangeToken(tok) {
    // "a..b" (a ou b podem ser vazios)
    const [a, b] = tok.split("..");
    const min = a === "" || a === undefined ? null : Number(a);
    const max = b === "" || b === undefined ? null : Number(b);
    return [
        Number.isFinite(min) ? min : null,
        Number.isFinite(max) ? max : null,
    ];
}
// Mesmos grupos do front
const HIGHWAY_GROUPS = {
    primary: ["motorway", "trunk", "primary"],
    primary_link: ["motorway_link", "trunk_link", "primary_link"],
    secondary: ["secondary", "tertiary"],
    secondary_link: ["secondary_link", "tertiary_link"],
    local: [
        "residential",
        "living_street",
        "service",
        "services",
        "pedestrian",
        "footway",
        "steps",
    ],
};
const LANDUSE_GROUPS = {
    residential: ["residential", "village_green"],
    commercial: ["commercial", "retail"],
    industrial: ["industrial", "garages", "storage", "landfill"],
    agro: ["farmland", "farmyard", "orchard", "meadow"],
};
// Forma canônica dos veículos armazenados no big_1hz
const VEHICLE_NORMALIZATION = {
    "captur": "Captur",
    "daf cf 410": "DAF CF 410",
    "renegade": "Renegade",
};
// Quantidade máxima de segundos que terão links por aquisição (na página atual)
const MAX_SECS_WITH_LINKS_PER_ACQ = 5;
/**
 * Dado um array de segundos ordenados, escolhe até `limit` segundos
 * "espalhados" ao longo do intervalo (não apenas os primeiros).
 */
function pickRepresentativeSeconds(sortedSecs, limit) {
    const n = sortedSecs.length;
    if (n <= limit)
        return sortedSecs.slice();
    const result = [];
    for (let i = 0; i < limit; i++) {
        const idx = Math.floor((i * (n - 1)) / (limit - 1));
        const sec = sortedSecs[idx];
        if (!result.includes(sec)) {
            result.push(sec);
        }
    }
    return result;
}
function buildMongoMatch(q) {
    const and = [];
    console.log("[SearchBigService] buildMongoMatch() - raw query:", JSON.stringify(q));
    // ---- blocks: vehicle (normaliza para forma canônica) ----
    const bVehiclesRaw = splitList(q["b.vehicle"]);
    console.log("[SearchBigService] b.vehicle raw:", q["b.vehicle"]);
    console.log("[SearchBigService] b.vehicle split:", bVehiclesRaw);
    if (bVehiclesRaw.length) {
        const bVehicles = bVehiclesRaw.map((v) => {
            var _a;
            const key = v.toLowerCase();
            return (_a = VEHICLE_NORMALIZATION[key]) !== null && _a !== void 0 ? _a : v;
        });
        console.log("[SearchBigService] b.vehicle normalized:", bVehicles);
        and.push({ "block.vehicle": { $in: bVehicles } });
    }
    // ---- blocks: period ----
    const bPeriods = splitList(q["b.period"]);
    if (bPeriods.length) {
        and.push({ "block.meteo.period": { $in: bPeriods } });
    }
    // ---- blocks: condition ----
    const bConditions = splitList(q["b.condition"]);
    if (bConditions.length) {
        and.push({ "block.meteo.condition": { $in: bConditions } });
    }
    // ---- laneego ----
    const lLeft = splitList(q["l.left"]);
    if (lLeft.length) {
        and.push({ "laneego.left_disp": { $in: lLeft } });
    }
    const lRight = splitList(q["l.right"]);
    if (lRight.length) {
        and.push({ "laneego.right_disp": { $in: lRight } });
    }
    // ---- CAN: velocidade ----
    if (q["c.v"]) {
        const [mn, mx] = parseRangeToken(q["c.v"]);
        const cond = {};
        if (mn !== null)
            cond.$gte = mn;
        if (mx !== null)
            cond.$lte = mx;
        if (Object.keys(cond).length) {
            and.push({ "can.VehicleSpeed": cond });
        }
    }
    // ---- CAN: SWA (vários ranges em OR) ----
    if (q["c.swa"]) {
        const parts = q["c.swa"].split(",").map((s) => s.trim()).filter(Boolean);
        const ors = [];
        for (const p of parts) {
            const [mn, mx] = parseRangeToken(p);
            const cond = {};
            if (mn !== null)
                cond.$gte = mn;
            if (mx !== null)
                cond.$lte = mx;
            if (Object.keys(cond).length)
                ors.push({ "can.SteeringWheelAngle": cond });
        }
        if (ors.length === 1)
            and.push(ors[0]);
        else if (ors.length > 1)
            and.push({ $or: ors });
    }
    // ---- CAN: freio (limpa padrão b'...') ----
    const rawBrakes = splitList(q["c.brakes"]);
    if (rawBrakes.length) {
        const brakes = rawBrakes.map((v) => {
            const m = v.match(/^b'(.*)'$/);
            return m ? m[1] : v;
        });
        and.push({ "can.BrakeInfoStatus": { $in: brakes } });
    }
    // ---- Overpass: highway groups ----
    const oHighwayGroups = splitList(q["o.highway"]);
    if (oHighwayGroups.length) {
        const concrete = [];
        oHighwayGroups.forEach((g) => {
            const arr = HIGHWAY_GROUPS[g];
            if (arr)
                concrete.push(...arr);
        });
        if (concrete.length) {
            and.push({ "overpass.highway": { $in: Array.from(new Set(concrete)) } });
        }
    }
    // ---- Overpass: landuse groups ----
    const oLanduseGroups = splitList(q["o.landuse"]);
    if (oLanduseGroups.length) {
        const concrete = [];
        oLanduseGroups.forEach((g) => {
            const arr = LANDUSE_GROUPS[g];
            if (arr)
                concrete.push(...arr);
        });
        if (concrete.length) {
            and.push({ "overpass.landuse": { $in: Array.from(new Set(concrete)) } });
        }
    }
    // ---- Overpass: lanes / maxspeed numéricos ----
    const oLanes = splitList(q["o.lanes"])
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
    if (oLanes.length) {
        and.push({ "overpass.lanes": { $in: oLanes } });
    }
    const oMax = splitList(q["o.maxspeed"])
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
    if (oMax.length) {
        and.push({ "overpass.maxspeed": { $in: oMax } });
    }
    // ---- Overpass: categóricos ----
    const oOneway = splitList(q["o.oneway"]);
    if (oOneway.length) {
        and.push({ "overpass.oneway": { $in: oOneway } });
    }
    const oSurface = splitList(q["o.surface"]);
    if (oSurface.length) {
        and.push({ "overpass.surface": { $in: oSurface } });
    }
    const oSidewalk = splitList(q["o.sidewalk"]);
    if (oSidewalk.length) {
        and.push({ "overpass.sidewalk": { $in: oSidewalk } });
    }
    const oCycle = splitList(q["o.cycleway"]);
    if (oCycle.length) {
        and.push({ "overpass.cycleway": { $in: oCycle } });
    }
    // ---- SemSeg: building ----
    if (q["s.building"]) {
        const parts = q["s.building"].split(",").map((s) => s.trim()).filter(Boolean);
        const ors = [];
        for (const p of parts) {
            const [mn, mx] = parseRangeToken(p);
            const cond = {};
            if (mn !== null)
                cond.$gte = mn;
            if (mx !== null)
                cond.$lte = mx;
            if (Object.keys(cond).length)
                ors.push({ "semseg.building": cond });
        }
        if (ors.length === 1)
            and.push(ors[0]);
        else if (ors.length > 1)
            and.push({ $or: ors });
    }
    // ---- SemSeg: vegetation ----
    if (q["s.vegetation"]) {
        const parts = q["s.vegetation"].split(",").map((s) => s.trim()).filter(Boolean);
        const ors = [];
        for (const p of parts) {
            const [mn, mx] = parseRangeToken(p);
            const cond = {};
            if (mn !== null)
                cond.$gte = mn;
            if (mx !== null)
                cond.$lte = mx;
            if (Object.keys(cond).length)
                ors.push({ "semseg.vegetation": cond });
        }
        if (ors.length === 1)
            and.push(ors[0]);
        else if (ors.length > 1)
            and.push({ $or: ors });
    }
    // ---- YOLO: classes ----
    const yClasses = splitList(q["y.class"]);
    if (yClasses.length) {
        and.push({
            yolo: {
                $elemMatch: { class: { $in: yClasses } },
            },
        });
    }
    // ---- YOLO: rel_to_ego ----
    const yRel = splitList(q["y.rel"]);
    if (yRel.length) {
        and.push({
            yolo: {
                $elemMatch: { rel_to_ego: { $in: yRel } },
            },
        });
    }
    // ---- YOLO: conf ----
    if (q["y.conf"]) {
        const parts = q["y.conf"].split(",").map((s) => s.trim()).filter(Boolean);
        const ors = [];
        for (const p of parts) {
            const [mn, mx] = parseRangeToken(p);
            const cond = {};
            if (mn !== null)
                cond.$gte = mn;
            if (mx !== null)
                cond.$lte = mx;
            if (Object.keys(cond).length)
                ors.push({ conf: cond });
        }
        if (ors.length) {
            and.push({
                yolo: {
                    $elemMatch: { $or: ors },
                },
            });
        }
    }
    // ---- YOLO: dist_m ----
    if (q["y.dist_m"]) {
        const [mn, mx] = parseRangeToken(q["y.dist_m"]);
        const cond = {};
        if (mn !== null)
            cond.$gte = mn;
        if (mx !== null)
            cond.$lte = mx;
        if (Object.keys(cond).length) {
            and.push({
                yolo: {
                    $elemMatch: { dist_m: cond },
                },
            });
        }
    }
    let match;
    if (!and.length)
        match = {};
    else if (and.length === 1)
        match = and[0];
    else
        match = { $and: and };
    console.log("[SearchBigService] final $match:", JSON.stringify(match));
    return match;
}
/* ================= Service ================= */
class SearchBigService {
    execute(query) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(1, Number((_a = query.page) !== null && _a !== void 0 ? _a : "1") || 1);
            const perPage = Math.max(1, Number((_b = query.per_page) !== null && _b !== void 0 ? _b : "100") || 100);
            const match = buildMongoMatch(query);
            const isEmptyMatch = !match || (Object.keys(match).length === 0 && match.constructor === Object);
            // Proteção: evita varrer a coleção inteira sem nenhum filtro.
            if (isEmptyMatch) {
                console.warn("[SearchBigService] empty $match – aborting full scan");
                return {
                    page,
                    per_page: perPage,
                    has_more: false,
                    matched_acq_ids: 0,
                    total_hits: 0,
                    items: [],
                };
            }
            // 1º pipeline: busca todos os segundos que batem, SEM links (JSON leve)
            const pipeline = [
                { $match: match },
                {
                    $project: {
                        acq_id: 1,
                        acq_id_raw: 1,
                        acq_name: 1,
                        sec: 1,
                        // links intencionalmente fora aqui
                    },
                },
            ];
            console.log("[SearchBigService] aggregateRaw pipeline (passo 1, sem links):", JSON.stringify(pipeline));
            let raw;
            try {
                raw = yield prisma_1.default.big1Hz.aggregateRaw({
                    pipeline,
                });
            }
            catch (err) {
                console.error("[SearchBigService] aggregateRaw (passo 1) ERROR:", err);
                throw err;
            }
            const rawArr = raw;
            // Mapeia todos os hits SEM links por enquanto
            const allRows = rawArr.map((doc) => {
                var _a, _b, _c;
                return ({
                    acq_id: typeof doc.acq_id === "number" ? doc.acq_id : null,
                    acq_id_raw: (_a = doc.acq_id_raw) !== null && _a !== void 0 ? _a : null,
                    acq_name: (_b = doc.acq_name) !== null && _b !== void 0 ? _b : null,
                    sec: (_c = doc.sec) !== null && _c !== void 0 ? _c : 0,
                    links: [], // preencheremos somente em alguns segundos no passo 2
                });
            });
            // Ordena por acq_id, depois sec
            allRows.sort((a, b) => {
                var _a, _b;
                const aId = (_a = a.acq_id) !== null && _a !== void 0 ? _a : 0;
                const bId = (_b = b.acq_id) !== null && _b !== void 0 ? _b : 0;
                if (aId !== bId)
                    return aId - bId;
                return a.sec - b.sec;
            });
            const uniqueAcqIds = Array.from(new Set(allRows.map((h) => h.acq_id).filter((x) => x != null)));
            console.log("[SearchBigService] total docs agregados (sem links):", rawArr.length);
            console.log("[SearchBigService] acq_ids únicos:", uniqueAcqIds.length);
            // Paginação por acq_id
            const acqOrder = uniqueAcqIds;
            const totalAcq = acqOrder.length;
            const startIndex = (page - 1) * perPage;
            const pageAcqIds = acqOrder.slice(startIndex, startIndex + perPage);
            const pageSet = new Set(pageAcqIds);
            // Hits da página atual (sem links ainda)
            const pageHits = allRows.filter((h) => h.acq_id != null && pageSet.has(h.acq_id));
            const hasMore = startIndex + perPage < totalAcq;
            // Se não há hits na página, já retorna daqui
            if (!pageHits.length) {
                return {
                    page,
                    per_page: perPage,
                    has_more: hasMore,
                    matched_acq_ids: totalAcq,
                    total_hits: allRows.length,
                    items: [],
                };
            }
            const pairsToFetchLinks = [];
            const secsByAcq = new Map();
            // Agrupa segundos por acq_id
            for (const h of pageHits) {
                if (h.acq_id == null)
                    continue;
                const arr = (_c = secsByAcq.get(h.acq_id)) !== null && _c !== void 0 ? _c : [];
                arr.push(h.sec);
                secsByAcq.set(h.acq_id, arr);
            }
            // Para cada acq_id, escolhe até MAX_SECS_WITH_LINKS_PER_ACQ
            for (const [acqId, secs] of secsByAcq.entries()) {
                const sortedSecs = Array.from(new Set(secs)).sort((a, b) => a - b);
                const selectedSecs = pickRepresentativeSeconds(sortedSecs, MAX_SECS_WITH_LINKS_PER_ACQ);
                for (const s of selectedSecs) {
                    pairsToFetchLinks.push({ acq_id: acqId, sec: s });
                }
            }
            console.log("[SearchBigService] segundos que terão links (por acq_id):", JSON.stringify(pairsToFetchLinks));
            // 2º pipeline: busca links APENAS para (acq_id, sec) selecionados
            let linksByKey = new Map();
            if (pairsToFetchLinks.length) {
                const orConds = pairsToFetchLinks.map((p) => ({
                    acq_id: p.acq_id,
                    sec: p.sec,
                }));
                const pipelineLinks = [
                    { $match: { $or: orConds } },
                    {
                        $project: {
                            acq_id: 1,
                            sec: 1,
                            links: 1,
                        },
                    },
                ];
                console.log("[SearchBigService] aggregateRaw pipeline (passo 2, links apenas):", JSON.stringify(pipelineLinks));
                try {
                    const rawLinks = (yield prisma_1.default.big1Hz.aggregateRaw({
                        pipeline: pipelineLinks,
                    }));
                    linksByKey = new Map(rawLinks.map((doc) => {
                        var _a;
                        const acqId = typeof doc.acq_id === "number" ? doc.acq_id : null;
                        const sec = (_a = doc.sec) !== null && _a !== void 0 ? _a : 0;
                        const key = `${acqId !== null && acqId !== void 0 ? acqId : 0}_${sec}`;
                        const linksArr = Array.isArray(doc.links)
                            ? doc.links
                            : [];
                        return [key, linksArr];
                    }));
                    console.log("[SearchBigService] docs com links retornados no passo 2:", rawLinks.length);
                }
                catch (err) {
                    console.error("[SearchBigService] aggregateRaw (passo 2) ERROR:", err);
                    // Em caso de erro, segue sem links (melhor do que quebrar a busca)
                }
            }
            // Anexa links somente nos segundos selecionados; demais ficam com []
            const enrichedPageHits = pageHits.map((h) => {
                var _a;
                if (h.acq_id == null)
                    return h;
                const key = `${h.acq_id}_${h.sec}`;
                const links = (_a = linksByKey.get(key)) !== null && _a !== void 0 ? _a : [];
                return Object.assign(Object.assign({}, h), { links });
            });
            return {
                page,
                per_page: perPage,
                has_more: hasMore,
                matched_acq_ids: totalAcq,
                total_hits: allRows.length,
                items: enrichedPageHits,
            };
        });
    }
}
exports.SearchBigService = SearchBigService;
