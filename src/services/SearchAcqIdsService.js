"use strict";
// src/services/SearchAcqIdsService.ts
// Versão sincronizada com SearchBigService: reutiliza a mesma SearchQuery e buildMongoMatch,
// mas retorna apenas a lista de acq_id em ordem decrescente.
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
exports.SearchAcqIdsService = exports.buildMongoMatch = void 0;
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
exports.buildMongoMatch = buildMongoMatch;
/* ================= Service ================= */
class SearchAcqIdsService {
    execute(query) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(1, Number((_a = query.page) !== null && _a !== void 0 ? _a : "1") || 1);
            const perPage = Math.max(1, Number((_b = query.per_page) !== null && _b !== void 0 ? _b : "100") || 100);
            const match = buildMongoMatch(query);
            const isEmptyMatch = !match || (Object.keys(match).length === 0 && match.constructor === Object);
            if (isEmptyMatch) {
                console.warn("[SearchAcqIdsService] empty $match – aborting full scan");
                return {
                    page,
                    per_page: perPage,
                    has_more: false,
                    total: 0,
                    total_pages: 0,
                    acq_ids: [],
                };
            }
            const pipeline = [
                { "$match": match },
                { "$group": { _id: "$acq_id" } },
                { "$sort": { _id: -1 } }, // mais novo -> mais velho
            ];
            let raw;
            try {
                raw = yield prisma_1.default.big1Hz.aggregateRaw({ pipeline });
            }
            catch (err) {
                console.error("[SearchAcqIdsService] aggregateRaw ERROR:", err);
                throw err;
            }
            const rows = raw;
            const numericAcqIds = Array.from(new Set(rows
                .map((r) => r._id)
                .filter((id) => id !== null && id !== undefined)
                .map((id) => Number(id))
                .filter((n) => Number.isFinite(n))));
            numericAcqIds.sort((a, b) => b - a);
            const total = numericAcqIds.length;
            const start = (page - 1) * perPage;
            const pageAcqIds = numericAcqIds.slice(start, start + perPage);
            const hasMore = start + perPage < total;
            const acq_ids = pageAcqIds.map((id) => String(id));
            return {
                page,
                per_page: perPage,
                has_more: hasMore,
                total,
                total_pages: Math.ceil(total / perPage),
                acq_ids,
            };
        });
    }
}
exports.SearchAcqIdsService = SearchAcqIdsService;
