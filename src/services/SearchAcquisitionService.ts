// src/services/SearchAcquisitionService.ts
// Busca TODOS os segundos de UMA aquisição específica (acq_id numérico)
// que batem com os filtros (mesma lógica do SearchBigService),
// e traz os links da coleção Links (avi/csv/mf4/blf + imagens por segundo).

import { Prisma } from "@prisma/client";
import prismaClient from "../prisma";

/* ================= Types ================= */

export type AcquisitionLink = {
  ext: string;
  link: string;
  sec: number | null;
};

export type AcquisitionResult = {
  acq_id: string;      // ex: "20240129205623" (como veio da URL)
  seconds: number[];   // todos os sec que batem com os filtros
  links: AcquisitionLink[];
};

type SearchQuery = {
  // filtro principal
  acq_id?: string;

  // mesmos filtros do SearchBigService (sem paginação aqui)
  "b.vehicle"?: string;
  "b.period"?: string;
  "b.condition"?: string;

  "l.left"?: string;
  "l.right"?: string;

  "c.v"?: string;
  "c.swa"?: string;
  "c.brakes"?: string;

  "o.highway"?: string;
  "o.landuse"?: string;
  "o.lanes"?: string;
  "o.maxspeed"?: string;
  "o.oneway"?: string;
  "o.surface"?: string;
  "o.sidewalk"?: string;
  "o.cycleway"?: string;

  "s.building"?: string;
  "s.vegetation"?: string;

  "y.class"?: string;
  "y.rel"?: string;
  "y.conf"?: string;
  "y.dist_m"?: string;

  [key: string]: any;
};

/* ================= Helpers (mesmos do SearchBigService) ================= */

function splitList(v?: string | null): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRangeToken(tok: string): [number | null, number | null] {
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

function buildMongoMatch(q: SearchQuery): Record<string, any> {
  const and: any[] = [];

  // ---- blocks: vehicle ----
  const bVehiclesRaw = splitList(q["b.vehicle"]);
  if (bVehiclesRaw.length) {
    const bVehicles = bVehiclesRaw.map((v) => {
      const key = v.toLowerCase();
      return VEHICLE_NORMALIZATION[key] ?? v;
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

  if (!and.length) return {};
  if (and.length === 1) return and[0];
  return { $and: and };
}

/* ================= Service ================= */

class SearchAcquisitionService {
  async execute(rawQuery: SearchQuery): Promise<AcquisitionResult> {
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

    let finalMatch: Record<string, any>;
    if (!matchFilters || Object.keys(matchFilters).length === 0) {
      // sem filtros → só acq_id
      finalMatch = { acq_id: acqIdNum };
    } else {
      // acq_id + filtros
      finalMatch = { $and: [{ acq_id: acqIdNum }, matchFilters] };
    }

    const pipeline: Prisma.InputJsonValue[] = [
      { $match: finalMatch },
      {
        $project: {
          acq_id: 1,
          acq_id_raw: 1,
          sec: 1,
        },
      },
    ];

    let rawDocs: any[] = [];
    try {
      rawDocs = (await prismaClient.big1Hz.aggregateRaw({
        pipeline,
      })) as unknown as any[];
    } catch (err) {
      console.error("[SearchAcquisitionService] aggregateRaw ERROR:", err);
      throw err;
    }

    // 2) Pega todos os seconds que batem + possíveis acq_id_raw
    const secSet = new Set<number>();
    const acqIdRawSet = new Set<string>();

    for (const doc of rawDocs) {
      if (doc.sec != null) {
        secSet.add(doc.sec);
      }
      if (typeof doc.acq_id_raw === "string" && doc.acq_id_raw.trim()) {
        acqIdRawSet.add(doc.acq_id_raw.trim());
      }
    }

    const seconds = Array.from(secSet).sort((a, b) => a - b);

    // 3) Monta candidatos de acq_id para a coleção Links
    const linkAcqIds = new Set<string>();
    for (const v of acqIdRawSet) linkAcqIds.add(v);
    // também tenta com o próprio acqId numérico em string (caso você tenha links assim)
    linkAcqIds.add(acqIdStr);

    const linkAcqIdsArr = Array.from(linkAcqIds);
    let linksDocs: AcquisitionLink[] = [];

    if (linkAcqIdsArr.length > 0) {
      const OR: any[] = [{ sec: null }];
      if (seconds.length > 0) {
        OR.push({ sec: { in: seconds } });
      }

      const docs = await prismaClient.links.findMany({
        where: {
          acq_id: { in: linkAcqIdsArr },
          OR,
        },
        select: {
          ext: true,
          link: true,
          sec: true,
        },
      });

      linksDocs = docs.map((d) => ({
        ext: d.ext.toLowerCase(),
        link: d.link,
        sec: d.sec ?? null,
      }));
    }

    return {
      acq_id: acqIdStr,
      seconds,
      links: linksDocs,
    };
  }
}

export { SearchAcquisitionService };
