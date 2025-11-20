"use strict";
// src/services/SearchAcquisitionService.ts
// Busca TODOS os segundos de UMA aquisição específica (acq_id numérico)
// que batem com os filtros (mesma lógica do SearchBigService),
// e traz os links da coleção Links (avi/csv/mf4/blf + imagens por segundo).
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
exports.SearchAcquisitionService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
/* ================= Helpers (mesmos do SearchBigService) ================= */
function splitList(v) {
    if (!v)
        return [];
    return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}
function parseRangeToken(tok) {
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
function buildMongoMatch(q) {
    const and = [];
    // ---- blocks: vehicle ----
    const bVehiclesRaw = splitList(q["b.vehicle"]);
    if (bVehiclesRaw.length) {
        const bVehicles = bVehiclesRaw.map((v) => {
            var _a;
            const key = v.toLowerCase();
            return (_a = VEHICLE_NORMALIZATION[key]) !== null && _a !== void 0 ? _a : v;
        });
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
    // ---- CAN: freio ----
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
    if (!and.length)
        return {};
    if (and.length === 1)
        return and[0];
    return { $and: and };
}
/* ================= Service ================= */
class SearchAcquisitionService {
    execute(rawQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            const acqIdStr = rawQuery.acq_id;
            if (!acqIdStr) {
                throw new Error("ACQ_ID_REQUIRED");
            }
            const acqIdNum = Number(acqIdStr);
            if (!Number.isFinite(acqIdNum)) {
                throw new Error("ACQ_ID_INVALID");
            }
            // 1) Filtros (mesma lógica do SearchBigService)
            const matchFilters = buildMongoMatch(rawQuery);
            let finalMatch;
            if (!matchFilters || Object.keys(matchFilters).length === 0) {
                // sem filtros → só acq_id
                finalMatch = { acq_id: acqIdNum };
            }
            else {
                // acq_id + filtros
                finalMatch = { $and: [{ acq_id: acqIdNum }, matchFilters] };
            }
            const pipeline = [
                { $match: finalMatch },
                {
                    $project: {
                        acq_id: 1,
                        acq_id_raw: 1,
                        sec: 1,
                    },
                },
            ];
            let rawDocs = [];
            try {
                rawDocs = (yield prisma_1.default.big1Hz.aggregateRaw({
                    pipeline,
                }));
            }
            catch (err) {
                console.error("[SearchAcquisitionService] aggregateRaw ERROR:", err);
                throw err;
            }
            // 2) Pega todos os seconds que batem (mesmo comportamento que antes)
            const secSet = new Set();
            const acqIdRawSet = new Set();
            for (const doc of rawDocs) {
                if (doc.sec != null) {
                    secSet.add(doc.sec);
                }
                if (typeof doc.acq_id_raw === "string" && doc.acq_id_raw.trim()) {
                    acqIdRawSet.add(doc.acq_id_raw.trim());
                }
            }
            const seconds = Array.from(secSet).sort((a, b) => a - b);
            // 3) Busca links na coleção `links` para esse acq_id
            // Aqui usamos apenas o ID numérico passado (mesmo padrão do big_1hz).
            // Se o campo links.acq_id for BigInt no Prisma, troque para BigInt(acqIdStr).
            const acqIdForLinks = acqIdNum;
            const OR = [{ sec: null }];
            if (seconds.length > 0) {
                OR.push({ sec: { in: seconds } });
            }
            const docs = yield prisma_1.default.links.findMany({
                where: {
                    acq_id: acqIdForLinks,
                    OR,
                },
                select: {
                    ext: true,
                    link: true,
                    sec: true,
                },
            });
            const linksDocs = docs.map((d) => {
                var _a;
                return ({
                    ext: d.ext.toLowerCase(),
                    link: d.link,
                    sec: (_a = d.sec) !== null && _a !== void 0 ? _a : null,
                });
            });
            return {
                acq_id: acqIdStr,
                seconds,
                links: linksDocs,
            };
        });
    }
}
exports.SearchAcquisitionService = SearchAcquisitionService;
