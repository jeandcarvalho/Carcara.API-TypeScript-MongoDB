"use strict";
// src/services/SearchBigService.ts
// Busca em big_1hz com filtros do front (Search.tsx)
//
// Estratégia:
//  - 1º pipeline Mongo: filtra TODOS os segundos que batem (sem links).
//  - Ordena e pagina por acq_id no Node (mais novo → mais velho).
//  - Para os acq_ids da página, escolhe até N segundos representativos.
//  - 2º pipeline Mongo: busca links SOMENTE desses segundos (por acq_id/sec).
//  - Anexa um único link nesses poucos segundos; os demais vêm sem 'link'.
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
    captur: "Captur",
    "daf cf 410": "DAF CF 410",
    renegade: "Renegade",
};
// Quantidade máxima de segundos que terão link por aquisição (na página atual)
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
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(1, Number((_a = query.page) !== null && _a !== void 0 ? _a : "1") || 1);
            const perPage = Math.max(1, Number((_b = query.per_page) !== null && _b !== void 0 ? _b : "100") || 100);
            const match = buildMongoMatch(query);
            const isEmptyMatch = !match || (Object.keys(match).length === 0 && match.constructor === Object);
            // Proteção: evita varrer a coleção inteira sem nenhum filtro.
            if (isEmptyMatch) {
                console.warn("[SearchBigService] empty $match – aborting full scan");
                const counts = {
                    matched_acq_ids: 0,
                    matched_seconds: 0,
                };
                const page_info = {
                    page,
                    per_page: perPage,
                    has_more: false,
                    total: 0,
                    total_pages: 0,
                };
                return {
                    page,
                    per_page: perPage,
                    has_more: false,
                    counts,
                    page_info,
                    matched_acq_ids: counts.matched_acq_ids,
                    total_hits: counts.matched_seconds,
                    items: [],
                };
            }
            // 1º pipeline: busca todos os segundos que batem, SEM links (JSON leve)
            const pipeline = [
                { $match: match },
                {
                    $project: {
                        acq_id: 1,
                        sec: 1,
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
            // Mapeia todos os hits SEM link por enquanto
            const allRows = rawArr.map((doc) => {
                var _a;
                return ({
                    acq_id: typeof doc.acq_id === "number" ? doc.acq_id : null,
                    sec: (_a = doc.sec) !== null && _a !== void 0 ? _a : 0,
                });
            });
            // Ordena por acq_id DESC (mais novo → mais velho), depois sec ASC
            allRows.sort((a, b) => {
                var _a, _b;
                const aId = (_a = a.acq_id) !== null && _a !== void 0 ? _a : 0;
                const bId = (_b = b.acq_id) !== null && _b !== void 0 ? _b : 0;
                if (aId !== bId)
                    return bId - aId; // DESC
                return a.sec - b.sec; // dentro da aquisição, timeline normal
            });
            const uniqueAcqIds = Array.from(new Set(allRows.map((h) => h.acq_id).filter((x) => x != null)));
            console.log("[SearchBigService] total docs agregados (sem links):", rawArr.length);
            console.log("[SearchBigService] acq_ids únicos:", uniqueAcqIds.length);
            // Paginação por acq_id (já em ordem DESC)
            const acqOrder = uniqueAcqIds;
            const totalAcq = acqOrder.length;
            const matchedSeconds = allRows.length;
            const startIndex = (page - 1) * perPage;
            const pageAcqIds = acqOrder.slice(startIndex, startIndex + perPage);
            const pageSet = new Set(pageAcqIds);
            // Hits da página atual (sem link ainda)
            const pageHits = allRows.filter((h) => h.acq_id != null && pageSet.has(h.acq_id));
            const hasMore = startIndex + perPage < totalAcq;
            // Se não há hits na página, já retorna daqui
            if (!pageHits.length) {
                const counts = {
                    matched_acq_ids: totalAcq,
                    matched_seconds: matchedSeconds,
                };
                const page_info = {
                    page,
                    per_page: perPage,
                    has_more: hasMore,
                    total: totalAcq,
                    total_pages: Math.ceil(totalAcq / perPage),
                };
                return {
                    page,
                    per_page: perPage,
                    has_more: hasMore,
                    counts,
                    page_info,
                    matched_acq_ids: counts.matched_acq_ids,
                    total_hits: counts.matched_seconds,
                    items: [],
                };
            }
            // Se por algum motivo não há acq_ids na página, retorna vazio com contagens
            if (!pageAcqIds.length) {
                const counts = {
                    matched_acq_ids: totalAcq,
                    matched_seconds: matchedSeconds,
                };
                const page_info = {
                    page,
                    per_page: perPage,
                    has_more: hasMore,
                    total: totalAcq,
                    total_pages: Math.ceil(totalAcq / perPage),
                };
                return {
                    page,
                    per_page: perPage,
                    has_more: hasMore,
                    counts,
                    page_info,
                    matched_acq_ids: counts.matched_acq_ids,
                    total_hits: counts.matched_seconds,
                    items: [],
                };
            }
            // 2º pipeline: o Mongo já devolve até MAX_SECS_WITH_LINKS_PER_ACQ por aquisição,
            // apenas para docs da página que realmente têm link.
            const pipelineLinks = [
                {
                    $match: Object.assign(Object.assign({}, match), { acq_id: { $in: pageAcqIds }, "links.0.link": { $exists: true } }),
                },
                { $unwind: "$links" },
                {
                    $project: {
                        acq_id: 1,
                        sec: 1,
                        link: "$links.link",
                    },
                },
                { $sort: { acq_id: 1, sec: 1 } }, // aqui tanto faz, vamos reordenar em TS depois
                {
                    $group: {
                        _id: "$acq_id",
                        docs: {
                            $push: { sec: "$sec", link: "$link" },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        acq_id: "$_id",
                        docs: { $slice: ["$docs", MAX_SECS_WITH_LINKS_PER_ACQ] },
                    },
                },
            ];
            console.log("[SearchBigService] aggregateRaw pipeline (passo 2, links por página):", JSON.stringify(pipelineLinks));
            let rawLinks = [];
            try {
                rawLinks = (yield prisma_1.default.big1Hz.aggregateRaw({
                    pipeline: pipelineLinks,
                }));
            }
            catch (err) {
                console.error("[SearchBigService] aggregateRaw (passo 2) ERROR:", err);
                // Em caso de erro, segue sem links (melhor do que quebrar a busca)
                rawLinks = [];
            }
            const items = [];
            for (const group of rawLinks) {
                const acqIdRaw = group.acq_id;
                const acqId = typeof acqIdRaw === "number"
                    ? acqIdRaw
                    : Number(acqIdRaw !== null && acqIdRaw !== void 0 ? acqIdRaw : NaN);
                if (!Number.isFinite(acqId))
                    continue;
                const docs = group.docs;
                if (!Array.isArray(docs))
                    continue;
                for (const d of docs) {
                    const sec = d.sec;
                    const link = d.link;
                    if (typeof sec !== "number")
                        continue;
                    if (typeof link !== "string" || !link)
                        continue;
                    items.push({
                        acq_id: acqId,
                        sec,
                        link,
                    });
                }
            }
            console.log("[SearchBigService] total items (acq_id/sec com link) devolvidos na página:", items.length);
            // Garante que o array final venha em ordem cronológica:
            // acq_id DESC (mais novo → mais velho), sec ASC
            items.sort((a, b) => {
                var _a, _b;
                const aId = (_a = a.acq_id) !== null && _a !== void 0 ? _a : 0;
                const bId = (_b = b.acq_id) !== null && _b !== void 0 ? _b : 0;
                if (aId !== bId)
                    return bId - aId; // mais novo primeiro
                return a.sec - b.sec;
            });
            const counts = {
                matched_acq_ids: totalAcq,
                matched_seconds: matchedSeconds,
            };
            const page_info = {
                page,
                per_page: perPage,
                has_more: hasMore,
                total: totalAcq,
                total_pages: Math.ceil(totalAcq / perPage),
            };
            return {
                page,
                per_page: perPage,
                has_more: hasMore,
                counts,
                page_info,
                matched_acq_ids: counts.matched_acq_ids,
                total_hits: counts.matched_seconds,
                items,
            };
        });
    }
}
exports.SearchBigService = SearchBigService;
