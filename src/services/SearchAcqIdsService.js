"use strict";
// src/services/SearchAcqIdsService.ts
// Versão independente: contém SearchQuery + buildMongoMatch embutidos.
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
/* ============================================================
   buildMongoMatch — versão simplificada baseada no BigService
   (adicione todas as suas regras reais aqui)
   ============================================================ */
function buildMongoMatch(q) {
    const match = {};
    // Block
    if (q["b.vehicle"]) {
        match["block.vehicle"] = { $in: q["b.vehicle"].split(",") };
    }
    if (q["b.period"]) {
        match["block.meteo.period"] = { $in: q["b.period"].split(",") };
    }
    if (q["b.condition"]) {
        match["block.meteo.condition"] = { $in: q["b.condition"].split(",") };
    }
    // CAN
    if (q["c.v"]) {
        match["can.VehicleSpeed"] = { $in: q["c.v"].split(",") };
    }
    if (q["c.swa"]) {
        match["can.SteeringWheelAngle"] = { $in: q["c.swa"].split(",") };
    }
    if (q["c.b"]) {
        match["can.BrakeInfoStatus"] = { $in: q["c.b"].split(",") };
    }
    // Overpass
    if (q["o.highway"]) {
        match["overpass.highway"] = { $in: q["o.highway"].split(",") };
    }
    if (q["o.landuse"]) {
        match["overpass.landuse"] = { $in: q["o.landuse"].split(",") };
    }
    // SemSeg
    if (q["s.building"]) {
        match["semseg.building"] = { $in: q["s.building"].split(",") };
    }
    if (q["s.vegetation"]) {
        match["semseg.vegetation"] = { $in: q["s.vegetation"].split(",") };
    }
    // YOLO
    if (q["y.class"]) {
        match["yolo.class"] = { $in: q["y.class"].split(",") };
    }
    if (q["y.conf"]) {
        // Exemplo: faixa mínima
        match["yolo.conf"] = { $gte: Number(q["y.conf"]) };
    }
    if (q["y.dist"]) {
        match["yolo.dist_m"] = { $lte: Number(q["y.dist"]) };
    }
    if (q["y.rel"]) {
        match["yolo.rel_to_ego"] = { $in: q["y.rel"].split(",") };
    }
    return match;
}
exports.buildMongoMatch = buildMongoMatch;
/* ============================================================
   Serviço: retorna apenas acq_id em ordem decrescente
   ============================================================ */
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
