// src/services/SearchBigService.ts
// Busca em big_1hz com filtros do front (Search.tsx)
//
// Estratégia:
//  - 1º pipeline Mongo: filtra TODOS os segundos que batem (sem links).
//  - Ordena e pagina por acq_id no Node (mais novo → mais velho).
//  - Para os acq_ids da página, escolhe até N segundos representativos.
//  - 2º pipeline Mongo: busca links SOMENTE desses segundos (por acq_id/sec),
//    mas agora o fatiamento (até 5 por aquisição, bem espalhados) é feito em TS.
//  - Anexa um único link nesses poucos segundos; os demais segundos ficam sem 'link'.

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

/**
 * Dado um array de segundos ordenados, escolhe até `limit` segundos
 * "espalhados" ao longo do intervalo (não apenas os primeiros).
 */
function pickRepresentativeSeconds(sortedSecs: number[], limit: number): number[] {
  const n = sortedSecs.length;
  if (n <= limit) return sortedSecs.slice();

  const result: number[] = [];
  for (let i = 0; i < limit; i++) {
    const idx = Math.floor((i * (n - 1)) / (limit - 1));
    const sec = sortedSecs[idx];
    if (!result.includes(sec)) {
      result.push(sec);
    }
  }
  return result;
}

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
    const pipeline: Prisma.InputJsonValue[] = [
      { $match: match },
      {
        $project: {
          acq_id: 1,
          sec: 1,
        },
      },
    ];

    console.log(
      "[SearchBigService] aggregateRaw pipeline (passo 1, sem links):",
      JSON.stringify(pipeline),
    );

    let raw;
    try {
      raw = await prismaClient.big1Hz.aggregateRaw({
        pipeline,
      });
    } catch (err) {
      console.error("[SearchBigService] aggregateRaw (passo 1) ERROR:", err);
      throw err;
    }

    const rawArr = raw as unknown as any[];

    // Mapeia todos os hits SEM link por enquanto
    const allRows: SearchHit[] = rawArr.map((doc: any) => ({
      acq_id: typeof doc.acq_id === "number" ? doc.acq_id : null,
      sec: doc.sec ?? 0,
    }));

    // Ordena por acq_id DESC (mais novo → mais velho), depois sec ASC
    allRows.sort((a, b) => {
      const aId = a.acq_id ?? 0;
      const bId = b.acq_id ?? 0;
      if (aId !== bId) return bId - aId; // DESC
      return a.sec - b.sec; // dentro da aquisição, timeline normal
    });

    const uniqueAcqIds = Array.from(
      new Set(allRows.map((h) => h.acq_id).filter((x): x is number => x != null)),
    );

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
    const pageHits = allRows.filter(
      (h) => h.acq_id != null && pageSet.has(h.acq_id as number),
    );

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

    // 2º pipeline: busca TODOS os docs com link dos acq_ids da página
    // (já filtrados pelo mesmo $match). O fatiamento para 5 segundos
    // bem espaçados por aquisição será feito em TypeScript com
    // pickRepresentativeSeconds().
    const pipelineLinks: Prisma.InputJsonValue[] = [
      {
        $match: {
          ...match,
          acq_id: { $in: pageAcqIds },
          "links.0.link": { $exists: true },
        },
      },
      { $unwind: "$links" },
      {
        $project: {
          acq_id: 1,
          sec: 1,
          link: "$links.link",
        },
      },
      { $sort: { acq_id: 1, sec: 1 } }, // dentro de cada aquisição, timeline normal
    ];

    console.log(
      "[SearchBigService] aggregateRaw pipeline (passo 2, links por página):",
      JSON.stringify(pipelineLinks),
    );

    let rawLinks: any[] = [];
    try {
      rawLinks = (await prismaClient.big1Hz.aggregateRaw({
        pipeline: pipelineLinks,
      })) as unknown as any[];
    } catch (err) {
      console.error("[SearchBigService] aggregateRaw (passo 2) ERROR:", err);
      // Em caso de erro, segue sem links (melhor do que quebrar a busca)
      rawLinks = [];
    }

    // Agrupa por acq_id em memória
    const groupedLinks = new Map<
      number,
      { sec: number; link: string }[]
    >();

    for (const doc of rawLinks) {
      const acqIdRaw = (doc as any).acq_id;
      const acqId =
        typeof acqIdRaw === "number" ? acqIdRaw : Number(acqIdRaw ?? NaN);
      if (!Number.isFinite(acqId)) continue;

      const sec = (doc as any).sec;
      const link = (doc as any).link;
      if (typeof sec !== "number") continue;
      if (typeof link !== "string" || !link) continue;

      if (!groupedLinks.has(acqId)) {
        groupedLinks.set(acqId, []);
      }
      groupedLinks.get(acqId)!.push({ sec, link });
    }

    const items: SearchHit[] = [];

    // Para cada aquisição, escolhe até MAX_SECS_WITH_LINKS_PER_ACQ
    // segundos bem distribuídos ao longo da timeline.
    for (const [acqId, docs] of groupedLinks.entries()) {
      // Ordena por sec
      docs.sort((a, b) => a.sec - b.sec);

      const secs = docs.map((d) => d.sec);
      const chosenSecs = new Set(
        pickRepresentativeSeconds(secs, MAX_SECS_WITH_LINKS_PER_ACQ),
      );

      const usedSecs = new Set<number>();

      for (const d of docs) {
        if (!chosenSecs.has(d.sec)) continue;
        if (usedSecs.has(d.sec)) continue; // garante 1 link por segundo
        items.push({
          acq_id: acqId,
          sec: d.sec,
          link: d.link,
        });
        usedSecs.add(d.sec);
      }
    }

    console.log(
      "[SearchBigService] total items (acq_id/sec com link) devolvidos na página:",
      items.length,
    );

    // Garante que o array final venha em ordem cronológica:
    // acq_id DESC (mais novo → mais velho), sec ASC
    items.sort((a, b) => {
      const aId = a.acq_id ?? 0;
      const bId = b.acq_id ?? 0;
      if (aId !== bId) return bId - aId; // mais novo primeiro
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
  }
}

export { SearchBigService };
