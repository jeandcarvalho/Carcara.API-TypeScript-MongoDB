// src/services/SearchAcqIdsService.ts
// Versão sincronizada com SearchBigService: reutiliza a mesma SearchQuery e buildMongoMatch,
// mas retorna apenas a lista de acq_id em ordem decrescente.

import { Prisma } from "@prisma/client";
import prismaClient from "../prisma";

export type SearchQuery = {
  page?: string;
  per_page?: string;

  // blocks
  "b.vehicle"?: string;
  "b.period"?: string;
  "b.condition"?: string;

  // laneego
  "l.left"?: string;
  "l.right"?: string;

  // CAN
  "c.v"?: string;
  "c.swa"?: string;
  "c.brakes"?: string;

  // Overpass
  "o.highway"?: string;
  "o.landuse"?: string;
  "o.lanes"?: string;
  "o.maxspeed"?: string;
  "o.oneway"?: string;
  "o.surface"?: string;
  "o.sidewalk"?: string;
  "o.cycleway"?: string;

  // Semseg
  "s.building"?: string;
  "s.vegetation"?: string;

  // YOLO
  "y.class"?: string;
  "y.rel"?: string;
  "y.conf"?: string;
  "y.dist_m"?: string;
};

type SearchHit = {
  acq_id: number | null;
  sec: number;
  // só presente quando tiver link para esse segundo
  link?: string;
};

/* ================= Helpers ================= */

function splitList(v?: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRangeToken(tok: string): [number | null, number | null] {
  // "a..b" (a ou b podem ser vazios)
  const [a, b] = tok.split("..");
  const min = a === "" || a === undefined ? null : Number(a);
  const max = b === "" || b === undefined ? null : Number(b);
  return [
    Number.isFinite(min as number) ? (min as number) : null,
    Number.isFinite(max as number) ? (max as number) : null,
  ];
}

// Mesmos grupos do front
const HIGHWAY_GROUPS: Record<string, string[]> = {
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

const LANDUSE_GROUPS: Record<string, string[]> = {
  residential: ["residential", "village_green"],
  commercial: ["commercial", "retail"],
  industrial: ["industrial", "garages", "storage", "landfill"],
  agro: ["farmland", "farmyard", "orchard", "meadow"],
};

// Forma canônica dos veículos armazenados no big_1hz
const VEHICLE_NORMALIZATION: Record<string, string> = {
  captur: "Captur",
  "daf cf 410": "DAF CF 410",
  renegade: "Renegade",
};

// Quantidade máxima de segundos que terão link por aquisição (na página atual)
const MAX_SECS_WITH_LINKS_PER_ACQ = 5;

export function buildMongoMatch(q: SearchQuery): Record<string, any> {
  const and: any[] = [];

  console.log("[SearchBigService] buildMongoMatch() - raw query:", JSON.stringify(q));

  // ---- blocks: vehicle (normaliza para forma canônica) ----
  const bVehiclesRaw = splitList(q["b.vehicle"]);
  console.log("[SearchBigService] b.vehicle raw:", q["b.vehicle"]);
  console.log("[SearchBigService] b.vehicle split:", bVehiclesRaw);

  if (bVehiclesRaw.length) {
    const bVehicles = bVehiclesRaw.map((v) => {
      const key = v.toLowerCase();
      return VEHICLE_NORMALIZATION[key] ?? v;
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
    const cond: any = {};
    if (mn !== null) cond.$gte = mn;
    if (mx !== null) cond.$lte = mx;
    if (Object.keys(cond).length) {
      and.push({ "can.VehicleSpeed": cond });
    }
  }

  // ---- CAN: SWA (vários ranges em OR) ----
  if (q["c.swa"]) {
    const parts = q["c.swa"].split(",").map((s) => s.trim()).filter(Boolean);
    const ors: any[] = [];
    for (const p of parts) {
      const [mn, mx] = parseRangeToken(p);
      const cond: any = {};
      if (mn !== null) cond.$gte = mn;
      if (mx !== null) cond.$lte = mx;
      if (Object.keys(cond).length) ors.push({ "can.SteeringWheelAngle": cond });
    }
    if (ors.length === 1) and.push(ors[0]);
    else if (ors.length > 1) and.push({ $or: ors });
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
    const concrete: string[] = [];
    oHighwayGroups.forEach((g) => {
      const arr = HIGHWAY_GROUPS[g];
      if (arr) concrete.push(...arr);
    });
    if (concrete.length) {
      and.push({ "overpass.highway": { $in: Array.from(new Set(concrete)) } });
    }
  }

  // ---- Overpass: landuse groups ----
  const oLanduseGroups = splitList(q["o.landuse"]);
  if (oLanduseGroups.length) {
    const concrete: string[] = [];
    oLanduseGroups.forEach((g) => {
      const arr = LANDUSE_GROUPS[g];
      if (arr) concrete.push(...arr);
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
    const ors: any[] = [];
    for (const p of parts) {
      const [mn, mx] = parseRangeToken(p);
      const cond: any = {};
      if (mn !== null) cond.$gte = mn;
      if (mx !== null) cond.$lte = mx;
      if (Object.keys(cond).length) ors.push({ "semseg.building": cond });
    }
    if (ors.length === 1) and.push(ors[0]);
    else if (ors.length > 1) and.push({ $or: ors });
  }

  // ---- SemSeg: vegetation ----
  if (q["s.vegetation"]) {
    const parts = q["s.vegetation"].split(",").map((s) => s.trim()).filter(Boolean);
    const ors: any[] = [];
    for (const p of parts) {
      const [mn, mx] = parseRangeToken(p);
      const cond: any = {};
      if (mn !== null) cond.$gte = mn;
      if (mx !== null) cond.$lte = mx;
      if (Object.keys(cond).length) ors.push({ "semseg.vegetation": cond });
    }
    if (ors.length === 1) and.push(ors[0]);
    else if (ors.length > 1) and.push({ $or: ors });
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
    const ors: any[] = [];
    for (const p of parts) {
      const [mn, mx] = parseRangeToken(p);
      const cond: any = {};
      if (mn !== null) cond.$gte = mn;
      if (mx !== null) cond.$lte = mx;
      if (Object.keys(cond).length) ors.push({ conf: cond });
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
    const cond: any = {};
    if (mn !== null) cond.$gte = mn;
    if (mx !== null) cond.$lte = mx;
    if (Object.keys(cond).length) {
      and.push({
        yolo: {
          $elemMatch: { dist_m: cond },
        },
      });
    }
  }

  let match: Record<string, any>;
  if (!and.length) match = {};
  else if (and.length === 1) match = and[0];
  else match = { $and: and };

  console.log("[SearchBigService] final $match:", JSON.stringify(match));
  return match;
}

/* ================= Service ================= */


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
