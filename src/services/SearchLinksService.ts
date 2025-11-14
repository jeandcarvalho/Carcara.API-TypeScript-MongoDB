// services/SearchLinksService.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Número máximo de imagens por aquisição no preview
const MAX_IMG_PER_ACQ = 5;

// Helper de tempo/log
function stamp(label: string, prev: number, extra?: string) {
  const now = Date.now();
  const delta = now - prev;
  console.log(`[SearchLinksService] ${label} ${extra ? `(${extra})` : ''} +${delta}ms`);
  return now;
}

/* ===================== Helpers de parsing ===================== */

function splitList(v?: string | null) {
  if (!v) return [];
  return v.split(',').map(s => s.trim()).filter(Boolean);
}
function parseRange(tok?: string | null): [number | undefined, number | undefined] | undefined {
  if (!tok) return undefined;
  const [a, b] = tok.split('..');
  const lo = a === '' || a === undefined ? undefined : Number(a);
  const hi = b === '' || b === undefined ? undefined : Number(b);
  if (Number.isNaN(lo as any) && Number.isNaN(hi as any)) return undefined;
  return [lo, hi];
}
function inRange(numStr: string | null | undefined, lo?: number, hi?: number) {
  if (numStr == null || numStr === '') return false;
  const x = Number(numStr);
  if (!Number.isFinite(x)) return false;
  if (lo != null && x < lo) return false;
  if (hi != null && x > hi) return false;
  return true;
}

// range genérico [lo, hi] com hi opcional
type Range = [number | undefined, number | undefined];

/* ===================== Grupos Overpass ===================== */

const GROUPS = {
  highway: {
    primary: ["motorway", "trunk", "primary"],
    primary_link: ["motorway_link", "trunk_link", "primary_link"],
    secondary: ["secondary", "tertiary"],
    secondary_link: ["secondary_link", "tertiary_link"],
    local: ["residential", "living_street", "service", "services",
      "pedestrian",
      "footway",
      "steps",],
    unpaved: ["track", "path"],
    slow: ["residential", "living_street", "service", "unclassified", "tertiary", "secondary"],
    all: ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service", "track", "path"]
  },
  landuse: {
    residential: ["residential", "village_green"],
    commercial: ["commercial", "retail"],
    industrial: ["industrial", "garages", "storage", "landfill"],
    agro: ["farmland", "farmyard", "orchard", "meadow"],
    green: ["forest", "grass", "scrub", "recreation", "recreation_ground", "cemetery", "flowerbed", "greenfield"],
  }
} as const;

// Surface → grupos (paved/unpaved) para `o.surface`
const SURFACE_PAVED = new Set([
  "asphalt", "paved", "concrete", "concrete_plates", "paving_stones", "sett", "cement"
]);
const SURFACE_UNPAVED = new Set([
  "unpaved"
]);

// SemSeg thresholds (mesmos valores da UI)
const SEMSEG = {
  building: { p25: 0.0, median: 0.68, p75: 8.72 },
  vegetation: { p25: 0.0, median: 4.75, p75: 28.31 },
};



/* ===================== Helpers Overpass / Semseg ===================== */

function resolveHighwayGroups(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const tok of tokens) {
    const g = (GROUPS.highway as any)[tok];
    if (g) {
      for (const v of g) out.add(v);
    } else {
      out.add(tok);
    }
  }
  return [...out];
}
function resolveLanduseGroups(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const tok of tokens) {
    const g = (GROUPS.landuse as any)[tok];
    if (g) {
      for (const v of g) out.add(v);
    } else {
      out.add(tok);
    }
  }
  return [...out];
}

// Interseção de secondsMap
function intersectSeconds(
  base: Map<string, Set<number>> | null | undefined,
  next: Map<string, Set<number>>
): Map<string, Set<number>> {
  if (!base) {
    const clone = new Map<string, Set<number>>();
    for (const [k, set] of next.entries()) clone.set(k, new Set(set));
    return clone;
  }
  const out = new Map<string, Set<number>>();
  for (const [acq, setBase] of base.entries()) {
    const setNext = next.get(acq);
    if (!setNext) continue;
    const inter = new Set<number>();
    for (const s of setBase) if (setNext.has(s)) inter.add(s);
    if (inter.size > 0) out.set(acq, inter);
  }
  return out;
}

// Amostra k elementos distribuídos ao longo do array
function sampleEvenly<T>(arr: T[], k: number): T[] {
  const n = arr.length;
  if (n <= k) return [...arr];
  if (k <= 0) return [];
  const step = (n - 1) / (k - 1);
  const idxSet = new Set<number>();
  for (let i = 0; i < k; i++) {
    const idx = Math.round(i * step);
    idxSet.add(Math.max(0, Math.min(n - 1, idx)));
  }
  const out: T[] = [];
  const idxs = Array.from(idxSet).sort((a, b) => a - b);
  for (const i of idxs) out.push(arr[i]);
  for (let i = 0; out.length < k && i < n; i++) {
    if (!idxSet.has(i)) out.push(arr[i]);
  }
  return out;
}

// Echo dos filtros (para debug no front)
function echoParams(q: URLSearchParams) {
  const keys = [
    'b.vehicle', 'b.period', 'b.condition',
    'b.city', 'b.state', 'b.country',
    'c.v', 'c.swa', 'c.brakes',
    'l.left', 'l.right',
    'o.highway', 'o.landuse', 'o.surface', 'o.lanes', 'o.maxspeed', 'o.oneway', 'o.sidewalk', 'o.cycleway',
    's.building', 's.vegetation',
    'y.class', 'y.rel',
    'ext'
  ];
  const out: Record<string, any> = { b: {}, c: {}, l: {}, o: {}, s: {}, y: {} };
  for (const k of keys) {
    const v = q.get(k);
    if (!v) continue;
    const [ns, key] = k.split('.');
    if (key) {
      out[ns][key] = k.startsWith('c.') || k.startsWith('s.') || k.startsWith('y.') ? v : splitList(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/* ===================== Service ===================== */

export class SearchLinksService {
  // Compatível com seu controller (instância)
  async executeFromURL(rawUrl: string) {
    return SearchLinksService.search(rawUrl);
  }

  // Lógica principal
  static async search(rawUrl: string) {
    const t0 = Date.now();
    let t = t0;

    try {
      console.log('[SearchLinksService] ===== New search request =====');
      console.log(`[SearchLinksService] rawUrl = ${rawUrl}`);

      const url = new URL(rawUrl, 'https://carcara-web-api.onrender.com');
      const q = url.searchParams;

      const page = Math.max(1, Number(q.get('page') || '1'));
      const perPage = Math.max(1, Math.min(1000, Number(q.get('per_page') || '100')));
      console.log(`[SearchLinksService] pagination: page=${page}, per_page=${perPage}`);

      /* -------- blocos 5min -------- */

      const bVehicle = splitList(q.get('b.vehicle'));
      const bPeriod = splitList(q.get('b.period'));
      const bCondition = splitList(q.get('b.condition'));
      const bCity = splitList(q.get('b.city'));
      const bState = splitList(q.get('b.state'));
      const bCountry = splitList(q.get('b.country'));

      // Filtros CAN
      const cVRange = parseRange(q.get('c.v'));
      const cSwaRanges = splitList(q.get('c.swa')).map(parseRange).filter(Boolean) as Range[];
      const cBrakes = splitList(q.get('c.brakes'));

      // Filtros laneego
      const lLeft = splitList(q.get('l.left'));
      const lRight = splitList(q.get('l.right'));

      // Filtros Overpass
      const oHighwayTokens = splitList(q.get('o.highway'));
      const oLanduseTokens = splitList(q.get('o.landuse'));
      const oSurfaceTokens = splitList(q.get('o.surface'));
      const oLanes = splitList(q.get('o.lanes'));
      const oMaxspeed = splitList(q.get('o.maxspeed')).map(x => Number(x)).filter(x => Number.isFinite(x));
      const oOneway = splitList(q.get('o.oneway'));
      const oSidewalk = splitList(q.get('o.sidewalk'));
      const oCycleway = splitList(q.get('o.cycleway'));

      const oHighway = resolveHighwayGroups(oHighwayTokens);
      const oLanduse = resolveLanduseGroups(oLanduseTokens);

      // Filtros SemSeg
      const sBuildingTok = q.get('s.building');
      const sVegetationTok = q.get('s.vegetation');

      const sBuildingRange: Range | undefined = sBuildingTok ? (() => {
        const base = SEMSEG.building;
        if (sBuildingTok === 'low') return [0, base.median];
        if (sBuildingTok === 'mid') return [base.median, base.p75];
        if (sBuildingTok === 'high') return [base.p75, undefined];
        return undefined;
      })() : undefined;

      const sVegetationRange: Range | undefined = sVegetationTok ? (() => {
        const base = SEMSEG.vegetation;
        if (sVegetationTok === 'low') return [0, base.median];
        if (sVegetationTok === 'mid') return [base.median, base.p75];
        if (sVegetationTok === 'high') return [base.p75, undefined];
        return undefined;
      })() : undefined;

      // Filtros YOLO
  const yClassTok = q.get('y.class');
const yRelTok = q.get('y.rel');
const yConfTok = q.get('y.conf');
const yDistTok = q.get('y.dist_m');

const yClasses = splitList(yClassTok);
const yRel = splitList(yRelTok);

const yConfRange = parseRange(yConfTok);
const yDistRange = parseRange(yDistTok);

      // Extensões aceitas
      const extTokens = splitList(q.get('ext'));
      const allowedExts = extTokens.length ? extTokens : ['jpg', 'jpeg', 'png', 'webp', 'gif'];

      console.log('[SearchLinksService] blocks_5min filters:', { bVehicle, bPeriod, bCondition, bCity, bState, bCountry });
      console.log('[SearchLinksService] CAN filters:', { cVRange, cSwaRanges, cBrakes });
      console.log('[SearchLinksService] laneego filters:', { lLeft, lRight });
      console.log('[SearchLinksService] Overpass filters:', { oHighway, oLanduse, oSurfaceTokens, oLanes, oMaxspeed, oOneway, oSidewalk, oCycleway });
      console.log('[SearchLinksService] SemSeg filters:', { sBuildingRange, sVegetationRange });
      console.log('[SearchLinksService] YOLO filters:', { yClasses, yRel });
      console.log('[SearchLinksService] allowedExts:', allowedExts);

      // 1) blocks_5min → universo de aquisições
      const blocks = await prisma.blocks_5min.findMany({
        where: {
          ...(bVehicle.length ? { vehicle: { in: bVehicle } } : {}),
          ...(bPeriod.length ? { period: { in: bPeriod } } : {}),
          ...(bCondition.length ? { condition: { in: bCondition } } : {}),
          ...(bCity.length ? { city: { in: bCity } } : {}),
          ...(bState.length ? { state: { in: bState } } : {}),
          ...(bCountry.length ? { country: { in: bCountry } } : {}),
        },
        select: { acq_id: true },
      });

      t = stamp('blocks_5min.findMany', t, `rows=${blocks.length}`);
      const acqIds = [...new Set(blocks.map(b => b.acq_id))];
      console.log(`[SearchLinksService] acqIds (filtered) = ${acqIds.length}`);

      if (!acqIds.length) {
        console.log('[SearchLinksService] sem aquisições após filtros de bloco, encerrando cedo.');
        console.log(`[SearchLinksService] total elapsed = ${Date.now() - t0}ms`);
        return {
          filters_echo: echoParams(q),
          counts: { matched_acq_ids: 0, matched_seconds: 0, total_links: 0 },
          page_info: { page, per_page: perPage, has_more: false },
          documents: [],
        };
      }

      const acqUniverse = acqIds.map(String);

      // 2) Detectar se há filtros 1 Hz
      const laneFiltersActive = lLeft.length || lRight.length;
      const canActive = !!cVRange || cSwaRanges.length > 0 || cBrakes.length > 0;
      const yoloActive = yClasses.length > 0 || yRel.length > 0;
      const overpassActive = oHighway.length > 0 || oLanduse.length > 0 || oSurfaceTokens.length > 0 ||
        oLanes.length > 0 || oMaxspeed.length > 0 || oOneway.length > 0 ||
        oSidewalk.length > 0 || oCycleway.length > 0;
      const semsegActive = !!sBuildingRange || !!sVegetationRange;

      const anyFilters1Hz = laneFiltersActive || canActive || yoloActive || overpassActive || semsegActive;

      /* ========== CAMINHO RÁPIDO (SEM FILTROS 1 Hz) — AGGREGATE ========== */

      if (!anyFilters1Hz) {
        console.log('[SearchLinksService] Nenhum filtro 1Hz ativo → caminho rápido de preview por aquisição (aggregate).');

        // Pipeline de aggregate no Mongo para pegar até 5 imagens bem distribuídas por acq_id
        const pipeline: any[] = [
          {
            $match: {
              acq_id: { $in: acqUniverse },
              ext: { $in: allowedExts },
              sec: { $ne: null },
            },
          },
          { $sort: { acq_id: 1, sec: 1 } },
          {
            $group: {
              _id: "$acq_id",
              docs: {
                $push: {
                  sec: "$sec",
                  ext: "$ext",
                  link: "$link",
                },
              },
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              acq_id: "$_id",
              count: 1,
              docs: 1,
              idx0: { $literal: 0 },
              idx1: {
                $cond: [
                  { $gt: ["$count", 1] },
                  {
                    $floor: {
                      $divide: [
                        { $subtract: ["$count", 1] },
                        4,
                      ],
                    },
                  },
                  0,
                ],
              },
              idx2: {
                $cond: [
                  { $gt: ["$count", 2] },
                  {
                    $floor: {
                      $divide: [
                        {
                          $multiply: [
                            { $subtract: ["$count", 1] },
                            2,
                          ],
                        },
                        4,
                      ],
                    },
                  },
                  0,
                ],
              },
              idx3: {
                $cond: [
                  { $gt: ["$count", 3] },
                  {
                    $floor: {
                      $divide: [
                        {
                          $multiply: [
                            { $subtract: ["$count", 1] },
                            3,
                          ],
                        },
                        4,
                      ],
                    },
                  },
                  0,
                ],
              },
              idx4: {
                $cond: [
                  { $gt: ["$count", 4] },
                  { $subtract: ["$count", 1] },
                  0,
                ],
              },
            },
          },
          {
            $project: {
              acq_id: 1,
              count: 1,
              samples: {
                $setUnion: [[
                  { $arrayElemAt: ["$docs", "$idx0"] },
                  { $arrayElemAt: ["$docs", "$idx1"] },
                  { $arrayElemAt: ["$docs", "$idx2"] },
                  { $arrayElemAt: ["$docs", "$idx3"] },
                  { $arrayElemAt: ["$docs", "$idx4"] },
                ]],
              },
            },
          },
        ];

        // Rodando aggregate bruto via Prisma (Mongo)
        const aggResult: any = await (prisma as any).$runCommandRaw({
          aggregate: "links",
          pipeline,
          cursor: {},
        });

        const batch: any[] = (aggResult?.cursor?.firstBatch ?? []) as any[];

        t = stamp('links.aggregate (fast preview ALL acq)', t, `groups=${batch.length}`);

        type SampleRow = {
          acq_id: string;
          count: number;
          samples: { sec: number | null; ext?: string | null; link: string }[];
        };

        const preview: { acq_id: string; sec: number | null; ext?: string | null; link: string }[] = [];
        let totalRawSeconds = 0;

        for (const row of batch as SampleRow[]) {
          const acq = String(row.acq_id);
          const count = row.count ?? 0;
          totalRawSeconds += count;

          if (Array.isArray(row.samples)) {
            for (const s of row.samples) {
              if (!s) continue;
              preview.push({
                acq_id: acq,
                sec: s.sec ?? null,
                ext: s.ext ?? null,
                link: s.link,
              });
            }
          }
        }

        const matchedAcqCount = batch.length;
        const totalPreview = preview.length;
        const totalPages = Math.max(1, Math.ceil(totalPreview / perPage));
        const start = (page - 1) * perPage;
        const end = start + perPage;
        const pageDocs = preview.slice(start, end);
        const hasMore = page < totalPages;

        console.log(
          `[SearchLinksService] FAST PREVIEW (AGG): acq_ids=${matchedAcqCount}, total_raw_links=${totalRawSeconds}, total_preview_links=${totalPreview}`
        );
        console.log(
          `[SearchLinksService] page_info = page=${page}, per_page=${perPage}, docs_page=${pageDocs.length}`
        );
        console.log(`[SearchLinksService] total elapsed = ${Date.now() - t0}ms`);

        return {
          filters_echo: echoParams(q),
          counts: {
            matched_acq_ids: matchedAcqCount,
            matched_seconds: totalRawSeconds,
            total_links: totalPreview,
          },
          page_info: {
            page,
            per_page: perPage,
            has_more: hasMore,
            total: totalPreview,
            total_pages: totalPages,
          },
          documents: pageDocs.map(d => ({
            acq_id: d.acq_id,
            sec: d.sec,
            ext: d.ext ?? undefined,
            link: d.link,
          })),
        };
      }

      /* ========== CAMINHO COMPLETO (COM FILTROS 1 Hz) ========== */

      let secondsMap: Map<string, Set<number>> | null = null;

      // laneego_1hz
      if (lLeft.length || lRight.length) {
        console.log('[SearchLinksService] Aplicando filtros laneego_1hz...');
        const rows = await prisma.laneego_1hz.findMany({
          where: {
            acq_id: { in: acqUniverse },
            ...(lLeft.length ? { left_disp: { in: lLeft } } : {}),
            ...(lRight.length ? { right_disp: { in: lRight } } : {}),
          },
          select: { acq_id: true, sec: true },
        });
        t = stamp('laneego_1hz.findMany', t, `rows=${rows.length}`);

        const ok = new Map<string, Set<number>>();
        for (const r of rows) {
          if (r.sec == null) continue;
          const acq = String(r.acq_id);
          if (!ok.has(acq)) ok.set(acq, new Set());
          ok.get(acq)!.add(r.sec);
        }
        secondsMap = intersectSeconds(secondsMap, ok);
        console.log(`[SearchLinksService] after laneego intersect: acq_ids=${secondsMap.size}`);
      }

      // can_1hz
      if (!!cVRange || cSwaRanges.length > 0 || cBrakes.length > 0) {
        console.log('[SearchLinksService] Aplicando filtros can_1hz...');
        const whereCan: any = {
          acq_id: { in: acqUniverse },
        };
        // Empurra BrakeInfoStatus (filtro categórico) para o banco.
        if (cBrakes.length > 0) {
          whereCan.BrakeInfoStatus = { in: cBrakes };
        }
        const rows = await prisma.can_1hz.findMany({
          where: whereCan,
          select: {
            acq_id: true,
            sec: true,
            VehicleSpeed: true,
            SteeringWheelAngle: true,
            BrakeInfoStatus: true,
          },
        });
        t = stamp('can_1hz.findMany', t, `rows=${rows.length}`);

        const ok = new Map<string, Set<number>>();
        for (const r of rows) {
          if (r.sec == null) continue;
          const acq = String(r.acq_id);
          let pass = true;

          if (cVRange) {
            pass = pass && inRange(r.VehicleSpeed as any, cVRange[0], cVRange[1]);
          }
          if (pass && cSwaRanges.length) {
            const swa = r.SteeringWheelAngle == null ? null : Number(r.SteeringWheelAngle);
            let anySwa = false;
            for (const [lo, hi] of cSwaRanges) {
              if (inRange(String(swa), lo, hi)) {
                anySwa = true;
                break;
              }
            }
            pass = anySwa;
          }
          if (pass && cBrakes.length) {
            const val = String(r.BrakeInfoStatus ?? '');
            pass = cBrakes.includes(val);
          }

          if (!pass) continue;
          if (!ok.has(acq)) ok.set(acq, new Set());
          ok.get(acq)!.add(r.sec);
        }

        secondsMap = intersectSeconds(secondsMap, ok);
        console.log(`[SearchLinksService] after CAN intersect: acq_ids=${secondsMap.size}`);
      }

      // yolo_1hz















      
      {
        const yoloActive = (
          yClasses.length > 0 ||
          yRel.length > 0 ||
          !!yConfRange ||
          !!yDistRange
        );

        if (yoloActive) {
          console.log('[SearchLinksService] Aplicando filtros yolo_1hz...');

          // Filtro mínimo no banco: só por acq_id, class e rel_to_ego.
          // Os ranges de conf/dist_m são aplicados em memória para evitar problemas
          // com tipos (ex.: colunas armazenadas como string).
          const whereYolo: any = {
            acq_id: { in: acqUniverse },
          };

          if (yClasses.length) {
            whereYolo.class = { in: yClasses };
          }
          if (yRel.length) {
            whereYolo.rel_to_ego = { in: yRel };
          }

          const rows = await prisma.yolo_1hz.findMany({
            where: whereYolo,
            select: {
              acq_id: true,
              sec: true,
              conf: true,
              dist_m: true,
            },
          });
          t = stamp('yolo_1hz.findMany', t, `rows=${rows.length}`);

          const ok = new Map<string, Set<number>>();

          for (const r of rows) {
            if (r.sec == null) continue;

            // Aplica filtros numéricos de conf/dist_m aqui em JS,
            // convertendo valores para número quando possível.
            let pass = true;

            if (yConfRange) {
              const [lo, hi] = yConfRange;
              const val = r.conf as any;
              pass = inRange(val, lo, hi);
            }

            if (pass && yDistRange) {
              const [lo, hi] = yDistRange;
              const val = r.dist_m as any;
              pass = inRange(val, lo, hi);
            }

            if (!pass) continue;

            const acq = String(r.acq_id);
            if (!ok.has(acq)) ok.set(acq, new Set());
            ok.get(acq)!.add(r.sec);
          }

          secondsMap = intersectSeconds(secondsMap, ok);
          console.log(`[SearchLinksService] after yolo intersect: acq_ids=${secondsMap.size}`);
        }
      }

      // overpass_1hz
// overpass_1hz
      if (overpassActive) {
        console.log('[SearchLinksService] Aplicando filtros overpass_1hz...');

        const highwayVals = new Set<string>();
        const landuseVals = new Set<string>();

        for (const h of oHighway) highwayVals.add(h);
        for (const l of oLanduse) landuseVals.add(l);

        const rows = await prisma.overpass_1hz.findMany({
          where: {
            acq_id: { in: acqUniverse },
            ...(highwayVals.size ? { highway: { in: [...highwayVals] } } : {}),
            ...(landuseVals.size ? { landuse: { in: [...landuseVals] } } : {}),
            ...(oLanes.length ? { lanes: { in: oLanes } } : {}),
            ...(oMaxspeed.length ? { maxspeed: { in: oMaxspeed.map(String) } } : {}),
            ...(oOneway.length ? { oneway: { in: oOneway } } : {}),
            ...(oSidewalk.length ? { sidewalk: { in: oSidewalk } } : {}),
            ...(oCycleway.length ? { cycleway: { in: oCycleway } } : {}),
          },
          select: {
            acq_id: true,
            sec: true,
            highway: true,
            landuse: true,
            surface: true,
          },
        });
        t = stamp('overpass_1hz.findMany', t, `rows=${rows.length}`);

        const ok = new Map<string, Set<number>>();

        for (const r of rows) {
          if (r.sec == null) continue;
          const acq = String(r.acq_id);

          let pass = true;

          if (oSurfaceTokens.length) {
            let matchesAny = false;
            for (const tok of oSurfaceTokens) {
              if (tok === 'paved') {
                if (r.surface && SURFACE_PAVED.has(r.surface)) {
                  matchesAny = true;
                  break;
                }
              } else if (tok === 'unpaved') {
                if (r.surface && SURFACE_UNPAVED.has(r.surface)) {
                  matchesAny = true;
                  break;
                }
              } else {
                if (r.surface === tok) {
                  matchesAny = true;
                  break;
                }
              }
            }
            pass = matchesAny;
          }

          if (!pass) continue;
          if (!ok.has(acq)) ok.set(acq, new Set());
          ok.get(acq)!.add(r.sec);
        }

        secondsMap = intersectSeconds(secondsMap, ok);
        console.log(`[SearchLinksService] after overpass intersect: acq_ids=${secondsMap.size}`);
      }

      // semseg_1hz
      if (sBuildingRange || sVegetationRange) {
        console.log('[SearchLinksService] Aplicando filtros semseg_1hz...');
        const rows = await prisma.semseg_1hz.findMany({
          where: {
            acq_id: { in: acqUniverse },
          },
          select: {
            acq_id: true,
            sec: true,
            building: true,
            vegetation: true,
          },
        });
        t = stamp('semseg_1hz.findMany', t, `rows=${rows.length}`);

        const ok = new Map<string, Set<number>>();
        for (const r of rows) {
          if (r.sec == null) continue;
          const acq = String(r.acq_id);

          let bOK = true;
          if (sBuildingRange) {
            const [lo, hi] = sBuildingRange;
            bOK = inRange(r.building as any, lo, hi);
          }
          let vOK = true;
          if (sVegetationRange) {
            const [lo, hi] = sVegetationRange;
            vOK = inRange(r.vegetation as any, lo, hi);
          }
          if (bOK && vOK) {
            if (!ok.has(acq)) ok.set(acq, new Set());
            ok.get(acq)!.add(r.sec);
          }
        }
        secondsMap = intersectSeconds(secondsMap, ok);
        console.log(`[SearchLinksService] after SemSeg intersect: acq_ids=${secondsMap.size}`);
      }

      if (!secondsMap || secondsMap.size === 0) {
        console.log('[SearchLinksService] matchedAcq vazio após filtros 1Hz, encerrando cedo.');
        console.log(`[SearchLinksService] total elapsed = ${Date.now() - t0}ms`);
        return {
          filters_echo: echoParams(q),
          counts: { matched_acq_ids: 0, matched_seconds: 0, total_links: 0 },
          page_info: { page, per_page: perPage, has_more: false },
          documents: [],
        };
      }

      const matchedAcq = [...secondsMap.keys()].filter(k => secondsMap!.get(k)!.size > 0);
      const matchedSecondsCount = [...secondsMap.values()].reduce((s, set) => s + set.size, 0);
      console.log(`[SearchLinksService] matchedAcq_ids=${matchedAcq.length}, matchedSeconds=${matchedSecondsCount}`);

      const finalAcq = matchedAcq.length ? matchedAcq : acqUniverse;
      console.log(`[SearchLinksService] finalAcq_ids=${finalAcq.length}`);

      // 3) Amostragem de segundos: até MAX_IMG_PER_ACQ por aquisição
      const sampledSecondsByAcq = new Map<string, number[]>();
      for (const acq of finalAcq) {
        const secSet = secondsMap.get(String(acq));
        if (!secSet || secSet.size === 0) continue;
        const secsSorted = [...secSet].sort((a, b) => a - b);
        const sampled = sampleEvenly(secsSorted, MAX_IMG_PER_ACQ);
        sampledSecondsByAcq.set(String(acq), sampled);
      }

      console.log(
        '[SearchLinksService] sampledSecondsByAcq sizes:',
        Array.from(sampledSecondsByAcq.entries())
          .map(([acq, secs]) => `${acq}:${secs.length}`)
          .join(', ')
      );

      const orConds: any[] = [];
      for (const [acq, secs] of sampledSecondsByAcq.entries()) {
        if (!secs.length) continue;
        orConds.push({ acq_id: acq, sec: { in: secs } });
      }

      if (!orConds.length) {
        console.log('[SearchLinksService] orConds vazio após sampling, nenhuma imagem para puxar.');
        console.log(`[SearchLinksService] total elapsed = ${Date.now() - t0}ms`);
        return {
          filters_echo: echoParams(q),
          counts: { matched_acq_ids: finalAcq.length, matched_seconds: matchedSecondsCount, total_links: 0 },
          page_info: { page, per_page: perPage, has_more: false },
          documents: [],
        };
      }

      // 4) links.findMany com segundos amostrados (já filtrados pelos 1 Hz)
      const allLinks = await prisma.links.findMany({
        where: {
          acq_id: { in: finalAcq },
          ext: { in: allowedExts },
          OR: orConds,
        },
        select: {
          acq_id: true,
          sec: true,
          ext: true,
          link: true,
        },
      });
      t = stamp('links.findMany (amostrado 1Hz)', t, `rows=${allLinks.length}`);

      const totalLinks = allLinks.length;
      const totalPages = Math.max(1, Math.ceil(totalLinks / perPage));
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const pageDocs = allLinks.slice(start, end);
      const hasMore = page < totalPages;

      const result = {
        filters_echo: echoParams(q),
        counts: {
          matched_acq_ids: finalAcq.length,
          matched_seconds: matchedSecondsCount,
          total_links: totalLinks,
        },
        page_info: {
          page,
          per_page: perPage,
          has_more: hasMore,
          total: totalLinks,
          total_pages: totalPages,
        },
        documents: pageDocs.map(d => ({
          acq_id: String(d.acq_id),
          sec: d.sec ?? null,
          ext: d.ext,
          link: d.link,
        })),
      };

      console.log(
        `[SearchLinksService] RESULT counts = acq_ids=${finalAcq.length}, seconds=${matchedSecondsCount}, total_links=${totalLinks}`
      );
      console.log(
        `[SearchLinksService] page_info = page=${page}, per_page=${perPage}, docs_page=${pageDocs.length}`
      );
      console.log(`[SearchLinksService] total elapsed = ${Date.now() - t0}ms`);

      return result;
    } finally {
      // mantém prisma vivo (conexão compartilhada)
    }
  }
}
