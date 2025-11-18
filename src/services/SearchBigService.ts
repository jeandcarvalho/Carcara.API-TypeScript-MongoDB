
// src/services/SearchBigService.ts
// Busca em big_1hz com filtros do front (Search.tsx)
// Agora: traz TODOS os segundos com links que baterem, sem limite por acq_id,
// e loga a quantidade total encontrada.

import { Prisma } from "@prisma/client";
import prismaClient from "../prisma";

type SearchQuery = {
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

type LinkObj = { ext?: string; link?: string };

type SearchHit = {
  acq_id: number | null;
  acq_id_raw: string | null;
  acq_name: string | null;
  sec: number;
  links: LinkObj[];
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
  "captur": "Captur",
  "daf cf 410": "DAF CF 410",
  "renegade": "Renegade",
};

function buildMongoMatch(q: SearchQuery): Record<string, any> {
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

class SearchBigService {
  async execute(query: SearchQuery) {
    const page = Math.max(1, Number(query.page ?? "1") || 1);
    const perPage = Math.max(1, Number(query.per_page ?? "100") || 100);

    const match = buildMongoMatch(query);
    const isEmptyMatch =
      !match || (Object.keys(match).length === 0 && match.constructor === Object);

    // Proteção: evita varrer e ordenar a coleção inteira sem filtro
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

    const pipeline: Prisma.InputJsonValue[] = [
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
      // 🔁 Removido $sort do Mongo para evitar erro 292 (limite de memória do sort).
      // A ordenação será feita em memória no Node após o aggregateRaw.
    ];

    console.log(
      "[SearchBigService] aggregateRaw pipeline:",
      JSON.stringify(pipeline)
    );

    let raw;
    try {
      raw = await prismaClient.big1Hz.aggregateRaw({
        pipeline,
      });
    } catch (err) {
      console.error("[SearchBigService] aggregateRaw ERROR:", err);
      throw err;
    }

    const rawArr = raw as unknown as any[];

    let rows: SearchHit[] = rawArr.map((doc: any) => ({
      acq_id: typeof doc.acq_id === "number" ? doc.acq_id : null,
      acq_id_raw: doc.acq_id_raw ?? null,
      acq_name: doc.acq_name ?? null,
      sec: doc.sec ?? 0,
      links: Array.isArray(doc.links) ? (doc.links as LinkObj[]) : [],
    }));

    // 🔎 Mantém apenas segundos que têm pelo menos 1 link
    const rowsWithLinks = rows.filter((h) => h.links && h.links.length > 0);

    // 🔁 Ordena em memória por acq_id, depois sec
    rowsWithLinks.sort((a, b) => {
      const aId = a.acq_id ?? 0;
      const bId = b.acq_id ?? 0;
      if (aId !== bId) return aId - bId;
      return a.sec - b.sec;
    });

    // 🔔 LOG SIMPLES PRA DEBUG
    const uniqueAcqIds = Array.from(
      new Set(
        rowsWithLinks.map((h) => h.acq_id).filter((x): x is number => x != null),
      ),
    );
    console.log("[SearchBigService] total docs agregados:", rawArr.length);
    console.log("[SearchBigService] docs com links:", rowsWithLinks.length);
    console.log("[SearchBigService] acq_ids únicos:", uniqueAcqIds.length);

    // Agora, SEM corte: TODOS os segundos com link que bateram
    const allHits = rowsWithLinks;

    // paginação por acq_id (a View agrupa por acq_id)
    const acqOrder = uniqueAcqIds; // já está em ordem crescente pelo sort acima
    const totalAcq = acqOrder.length;

    const startIndex = (page - 1) * perPage;
    const pageAcqIds = acqOrder.slice(startIndex, startIndex + perPage);
    const pageSet = new Set(pageAcqIds);

    const pageHits = allHits.filter(
      (h) => h.acq_id != null && pageSet.has(h.acq_id as number),
    );

    const hasMore = startIndex + perPage < totalAcq;

    return {
      page,
      per_page: perPage,
      has_more: hasMore,
      matched_acq_ids: totalAcq,
      total_hits: allHits.length,
      items: pageHits,
    };
  }
}

export { SearchBigService };
