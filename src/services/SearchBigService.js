"use strict";
// src/services/SearchBigService.ts
// Busca em big_1hz com filtros do front (Search.tsx)
// Agora: traz TODOS os segundos que baterem,
// mas limita a quantidade de segundos COM links por acq_id
// (ex.: 5 segundos bem espaçados), e o resto vem com links = [].
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
function buildMongoMatch(q) {
    const and = [];
    // ---- blocks ----
    const bVehicles = splitList(q["b.vehicle"]);
    if (bVehicles.length) {
        and.push({ "block.vehicle": { $in: bVehicles } });
    }
    const bPeriods = splitList(q["b.period"]);
    if (bPeriods.length) {
        and.push({ "block.meteo.period": { $in: bPeriods } });
    }
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
    // ---- CAN: freio ----
    const brakes = splitList(q["c.brakes"]);
    if (brakes.length) {
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
    if (!and.length)
        return {};
    if (and.length === 1)
        return and[0];
    return { $and: and };
}
/* ================= Service ================= */
class SearchBigService {
    execute(query) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(1, Number((_a = query.page) !== null && _a !== void 0 ? _a : "1") || 1);
            const perPage = Math.max(1, Number((_b = query.per_page) !== null && _b !== void 0 ? _b : "100") || 100);
            const match = buildMongoMatch(query);
            const pipeline = [
                { $match: match },
                {
                    $project: {
                        acq_id: 1,
                        acq_id_raw: 1,
                        acq_name: 1,
                        sec: 1,
                        links: 1,
                    },
                },
                { $sort: { acq_id: 1, sec: 1 } },
            ];
            const raw = yield prisma_1.default.big1Hz.aggregateRaw({
                pipeline,
            });
            const rawArr = raw;
            const rows = rawArr.map((doc) => {
                var _a, _b, _c;
                return ({
                    acq_id: typeof doc.acq_id === "number" ? doc.acq_id : null,
                    acq_id_raw: (_a = doc.acq_id_raw) !== null && _a !== void 0 ? _a : null,
                    acq_name: (_b = doc.acq_name) !== null && _b !== void 0 ? _b : null,
                    sec: (_c = doc.sec) !== null && _c !== void 0 ? _c : 0,
                    links: Array.isArray(doc.links) ? doc.links : [],
                });
            });
            // 🔎 Mantém apenas segundos que têm pelo menos 1 link (antes do corte)
            const rowsWithLinksBefore = rows.filter((h) => h.links && h.links.length > 0);
            // 📉 Limita quantidade de segundos COM link por acq_id
            const MAX_LINK_SECONDS_PER_ACQ = 5;
            const byAcq = new Map();
            for (const hit of rowsWithLinksBefore) {
                if (hit.acq_id == null)
                    continue;
                if (!byAcq.has(hit.acq_id)) {
                    byAcq.set(hit.acq_id, []);
                }
                byAcq.get(hit.acq_id).push(hit);
            }
            for (const [acqId, arr] of byAcq.entries()) {
                if (!arr.length)
                    continue;
                // já vem ordenado por sec pelo pipeline, mas garantimos:
                arr.sort((a, b) => a.sec - b.sec);
                if (arr.length <= MAX_LINK_SECONDS_PER_ACQ) {
                    continue; // poucas linhas, mantém todos os links
                }
                const lastIndex = arr.length - 1;
                const k = MAX_LINK_SECONDS_PER_ACQ;
                const keepIdx = new Set();
                // distribui índices de forma aproximadamente uniforme ao longo do array
                for (let i = 0; i < k; i++) {
                    const idx = Math.round((i * lastIndex) / (k - 1));
                    keepIdx.add(idx);
                }
                // garante que 0 e lastIndex estejam incluídos
                keepIdx.add(0);
                keepIdx.add(lastIndex);
                arr.forEach((hit, idx) => {
                    if (!keepIdx.has(idx)) {
                        // zera os links nos segundos que não serão usados pra imagens
                        hit.links = [];
                    }
                });
            }
            // Agora rowsWithLinksAfter é o mesmo array, mas com links vazios em boa parte
            const rowsWithLinksAfter = rows.filter((h) => h.links && h.links.length > 0);
            const uniqueAcqIds = Array.from(new Set(rowsWithLinksBefore
                .map((h) => h.acq_id)
                .filter((x) => x != null)));
            console.log("[SearchBigService] total docs agregados:", rawArr.length);
            console.log("[SearchBigService] docs que tinham links (antes do limite):", rowsWithLinksBefore.length);
            console.log("[SearchBigService] docs com links (após limite):", rowsWithLinksAfter.length);
            console.log("[SearchBigService] acq_ids únicos:", uniqueAcqIds.length);
            // allHits = todos os docs (segundos) que tinham links antes,
            // mas agora só alguns segundos por acq_id continuam com links preenchidos.
            const allHits = rowsWithLinksBefore;
            // paginação por acq_id (a View agrupa por acq_id)
            const acqOrder = uniqueAcqIds.sort((a, b) => a - b);
            const totalAcq = acqOrder.length;
            const startIndex = (page - 1) * perPage;
            const pageAcqIds = acqOrder.slice(startIndex, startIndex + perPage);
            const pageSet = new Set(pageAcqIds);
            const pageHits = allHits.filter((h) => h.acq_id != null && pageSet.has(h.acq_id));
            const hasMore = startIndex + perPage < totalAcq;
            return {
                page,
                per_page: perPage,
                has_more: hasMore,
                matched_acq_ids: totalAcq,
                total_hits: allHits.length,
                items: pageHits,
            };
        });
    }
}
exports.SearchBigService = SearchBigService;
