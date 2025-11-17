// src/services/SearchBigService.ts
// Busca em big_1hz com filtros do front (Search.tsx)
// Devolve até 5 segundos por acq_id, distribuídos na timeline.

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

function buildMongoMatch(q: SearchQuery): Record<string, any> {
  const and: any[] = [];

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

  // ---- CAN: freio ----
  const brakes = splitList(q["c.brakes"]);
  if (brakes.length) {
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

  if (!and.length) return {};
  if (and.length === 1) return and[0];
  return { $and: and };
}

// escolhe até maxSecs segundos por acq_id, distribuídos na timeline
function pickTopSecondsPerAcq(hits: SearchHit[], maxSecs = 5): SearchHit[] {
  const byAcq = new Map<number, SearchHit[]>();

  for (const h of hits) {
    if (h.acq_id == null) continue;
    if (!h.links || !h.links.length) continue;
    const arr = byAcq.get(h.acq_id) ?? [];
    arr.push(h);
    byAcq.set(h.acq_id, arr);
  }

  const sortedAcqIds = Array.from(byAcq.keys()).sort((a, b) => a - b);
  const final: SearchHit[] = [];

  for (const acqId of sortedAcqIds) {
    const arr = byAcq.get(acqId)!;
    arr.sort((a, b) => a.sec - b.sec);

    if (arr.length <= maxSecs) {
      final.push(...arr);
      continue;
    }

    const n = arr.length;
    const k = maxSecs;
    const chosen: SearchHit[] = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(((i + 0.5) * n) / k);
      const clampedIdx = Math.min(Math.max(idx, 0), n - 1);
      const cand = arr[clampedIdx];
      if (!chosen.find((h) => h.sec === cand.sec)) {
        chosen.push(cand);
      }
    }
    chosen.sort((a, b) => a.sec - b.sec);
    final.push(...chosen);
  }

  return final;
}

/* ================= Service ================= */

class SearchBigService {
  async execute(query: SearchQuery) {
    const page = Math.max(1, Number(query.page ?? "1") || 1);
    const perPage = Math.max(1, Number(query.per_page ?? "100") || 100);

    const match = buildMongoMatch(query);

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
      { $sort: { acq_id: 1, sec: 1 } },
    ];

    const raw = await prismaClient.big1Hz.aggregateRaw({
      pipeline,
    });

    const rawArr = raw as unknown as any[];

    const rows: SearchHit[] = rawArr.map((doc: any) => ({
      acq_id: typeof doc.acq_id === "number" ? doc.acq_id : null,
      acq_id_raw: doc.acq_id_raw ?? null,
      acq_name: doc.acq_name ?? null,
      sec: doc.sec ?? 0,
      links: Array.isArray(doc.links) ? (doc.links as LinkObj[]) : [],
    }));

    const allHits = pickTopSecondsPerAcq(rows, 5);

    // paginação por acq_id
    const acqOrder = Array.from(
      new Set(allHits.map((h) => h.acq_id).filter((x): x is number => x != null)),
    ).sort((a, b) => a - b);

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
