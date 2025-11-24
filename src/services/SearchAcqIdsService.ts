// src/services/SearchAcqIdsService.ts
// Versão independente: contém SearchQuery + buildMongoMatch embutidos.

import { Prisma } from "@prisma/client";
import prismaClient from "../prisma";

/* ============================================================
   SearchQuery — mesmo formato do BigService
   (copie/adapte conforme sua versão atual)
   ============================================================ */

export type SearchQuery = {
  page?: string | number;
  per_page?: string | number;

  // Block
  "b.vehicle"?: string;
  "b.period"?: string;
  "b.condition"?: string;

  // CAN
  "c.v"?: string;
  "c.swa"?: string;
  "c.b"?: string;

  // Overpass
  "o.highway"?: string;
  "o.landuse"?: string;

  // SemSeg
  "s.building"?: string;
  "s.vegetation"?: string;

  // YOLO
  "y.class"?: string;
  "y.conf"?: string;
  "y.dist"?: string;
  "y.rel"?: string;
};

/* ============================================================
   buildMongoMatch — versão simplificada baseada no BigService
   (adicione todas as suas regras reais aqui)
   ============================================================ */

export function buildMongoMatch(q: SearchQuery): Record<string, any> {
  const match: any = {};

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

/* ============================================================
   Serviço: retorna apenas acq_id em ordem decrescente
   ============================================================ */

class SearchAcqIdsService {
  async execute(query: SearchQuery) {
    const page = Math.max(1, Number(query.page ?? "1") || 1);
    const perPage = Math.max(1, Number(query.per_page ?? "100") || 100);

    const match = buildMongoMatch(query);
    const isEmptyMatch =
      !match || (Object.keys(match).length === 0 && match.constructor === Object);

    if (isEmptyMatch) {
      console.warn("[SearchAcqIdsService] empty $match – aborting full scan");
      return {
        page,
        per_page: perPage,
        has_more: false,
        total: 0,
        total_pages: 0,
        acq_ids: [] as string[],
      };
    }

    const pipeline: Prisma.InputJsonValue[] = [
      { "$match": match },
      { "$group": { _id: "$acq_id" } },
      { "$sort": { _id: -1 } }, // mais novo -> mais velho
    ];

    let raw: unknown;
    try {
      raw = await prismaClient.big1Hz.aggregateRaw({ pipeline });
    } catch (err) {
      console.error("[SearchAcqIdsService] aggregateRaw ERROR:", err);
      throw err;
    }

    const rows = raw as any[];

    const numericAcqIds = Array.from(
      new Set(
        rows
          .map((r) => (r as any)._id)
          .filter((id) => id !== null && id !== undefined)
          .map((id) => Number(id))
          .filter((n) => Number.isFinite(n)),
      )
    ) as number[];

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
  }
}

export { SearchAcqIdsService };
