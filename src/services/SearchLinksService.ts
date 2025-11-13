// services/SearchLinksService.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ===== Helpers de parsing (iguais ao front) =====
function splitList(v?: string | null) {
  if (!v) return [];
  return v.split(',').map(s => s.trim()).filter(Boolean);
}
function parseRange(tok?: string | null): [number|undefined, number|undefined] | undefined {
  if (!tok) return undefined;
  const [a,b] = tok.split('..');
  const lo = a === '' || a === undefined ? undefined : Number(a);
  const hi = b === '' || b === undefined ? undefined : Number(b);
  if (Number.isNaN(lo as any) && Number.isNaN(hi as any)) return undefined;
  return [lo, hi];
}
function inRange(numStr: string | null | undefined, lo?: number, hi?: number) {
  if (numStr == null || numStr === '') return false;
  const x = Number(numStr);
  if (!Number.isFinite(x)) return false;
  if (lo !== undefined && x < lo) return false;
  if (hi !== undefined && x > hi) return false;
  return true;
}

// ====== Grupos Overpass (espelham o front) ======
const GROUPS = {
  highway: {
    primary: ["motorway","trunk","primary"],
    primary_link: ["motorway_link","trunk_link","primary_link"],
    secondary: ["secondary","tertiary"],
    secondary_link: ["secondary_link","tertiary_link"],
    local: ["residential","living_street","unclassified","service","services","platform","pedestrian","footway","steps","path","cycleway","busway","track"],
  },
  landuse: {
    residential: ["residential","village_green"],
    commercial: ["commercial","retail"],
    industrial: ["industrial","garages","storage","landfill"],
    agro: ["farmland","farmyard","orchard","meadow"],
    green: ["forest","grass","scrub","recreation","recreation_ground","cemetery","flowerbed","greenfield"],
  }
} as const;

// Surface → grupos (paved/unpaved) para `o.surface`
const SURFACE_PAVED = new Set(["asphalt","paved","concrete","concrete_plates","paving_stones","sett","cement"]);
const SURFACE_UNPAVED = new Set(["unpaved","compacted","gravel","fine_gravel","dirt","earth","ground","pebblestone","grass","sand","mud","soil","clay"]);

// SemSeg thresholds (mesmos valores da UI)
const SEMSEG = {
  building: { p25: 0.0, median: 0.68, p75: 8.72 },
  vegetation: { p25: 23.99, median: 40.14, p75: 59.41 },
};

// Converte chips de semseg do front ("..p25", "p25..p75", "p75..")
// para um array de ranges numéricos
function semsegTokensToRanges(tokens: string[]): Array<[number|undefined, number|undefined]> {
  const ranges: Array<[number|undefined, number|undefined]> = [];
  for (const t of tokens) {
    const r = parseRange(t);
    if (r) ranges.push(r);
  }
  return ranges;
}

// Faz OR entre ranges: true se o valor cair em qualquer range
function inAnyRange(numStr: string | null | undefined, ranges: Array<[number|undefined, number|undefined]>) {
  if (!ranges.length) return true;
  return ranges.some(([lo,hi]) => inRange(numStr, lo, hi));
}

// Amostragem uniforme (início, meio e fim bem representados)
function sampleEvenly<T>(arr: T[], k: number): T[] {
  const n = arr.length;
  if (n <= k) return arr.slice();
  const idxSet = new Set<number>();
  for (let i = 0; i < k; i++) {
    const idx = Math.round((i * (n - 1)) / (k - 1));
    idxSet.add(idx);
  }
  // Garante exatamente k elementos (caso arredondamentos gerem duplicatas)
  const out: T[] = [];
  const idxs = Array.from(idxSet).sort((a,b)=>a-b);
  for (const i of idxs) out.push(arr[i]);
  for (let i = 0; out.length < k && i < n; i++) {
    if (!idxSet.has(i)) out.push(arr[i]);
  }
  return out;
}

export class SearchLinksService {
  /**
   * Recebe a URL da API (ex: /api/search?...), parseia os params e executa:
   * 1) blocks_5min → limita acq_id
   * 2) coleções 1Hz ativas → filtra & INTERSECTA segundos
   * 3) links → retorna todos documentos (sec=null e sec∈set), paginados
   *    **Filtro final**: limitar a 5 imagens (ext=jpg) por acq_id, com amostragem uniforme.
   */
  async executeFromURL(rawUrl: string) {
    try {
      const url = new URL(rawUrl, 'http://localhost'); // base dummy só pra parsear
      const q = url.searchParams;

      // ====== 0) paginação ======
      const page = Math.max(1, Number(q.get('page') || 1));
      const perPage = Math.max(1, Math.min(500, Number(q.get('per_page') || 100)));

      // ====== 1) BLOCO 5 MIN (b.*) ======
      const bVehicle = q.get('b.vehicle') || undefined;
      const bPeriod = q.get('b.period') || undefined;
      const bCondition = q.get('b.condition') || undefined;

      const whereBlocks: any = {};
      if (bVehicle) whereBlocks.vehicle = bVehicle;
      if (bPeriod) whereBlocks.period = bPeriod;
      if (bCondition) whereBlocks.condition = bCondition;

      const blocks = await prisma.blocks_5min.findMany({
        where: whereBlocks,
        select: { acq_id: true },
      });

      const acqIds = [...new Set(blocks.map(b => b.acq_id))];

      const acqUniverse = acqIds.length
        ? acqIds
        : (await prisma.blocks_5min.findMany({ select: { acq_id: true } })).map(b => b.acq_id);

      if (!acqUniverse.length) {
        return {
          filters_echo: echoParams(q),
          counts: { matched_acq_ids: 0, matched_seconds: 0, total_links: 0 },
          page_info: { page, per_page: perPage, has_more: false },
          documents: [],
        };
      }

      // ====== 2) 1Hz — coletar filtros ativos e INTERSECTAR por segundo ======
      let secondsMap: Map<string, Set<number>> | null = null;

      // ---- LaneEgo (l.*) ----
      const lLeft = splitList(q.get('l.left_disp'));
      const lRight = splitList(q.get('l.right_disp'));
      const laneFiltersActive = !!(lLeft.length || lRight.length);
      if (laneFiltersActive) {
        const rs = await prisma.laneego_1hz.findMany({
          where: { acq_id: { in: acqUniverse } },
          select: { acq_id: true, sec: true, left_disp: true, right_disp: true }
        });
        const ok = new Map<string, Set<number>>();
        for (const r of rs) {
          const okLeft = !lLeft.length || (r.left_disp && lLeft.includes(r.left_disp));
          const okRight = !lRight.length || (r.right_disp && lRight.includes(r.right_disp));
          if (okLeft && okRight) {
            if (!ok.has(r.acq_id)) ok.set(r.acq_id, new Set());
            ok.get(r.acq_id)!.add(r.sec);
          }
        }
        secondsMap = ok;
      }

      // ---- CAN (c.VehicleSpeed, c.SteeringWheelAngle, c.BrakeInfoStatus) ----
      const vRange = parseRange(q.get('c.VehicleSpeed'));
      const swaTok = q.get('c.SteeringWheelAngle');
      const swaRanges = splitList(swaTok).map(t => parseRange(t)).filter(Boolean) as Array<[number|undefined, number|undefined]>;
      const brakes = splitList(q.get('c.BrakeInfoStatus'));
      const canActive = !!(vRange || swaRanges.length || brakes.length);
      if (canActive) {
        const rs = await prisma.can_1hz.findMany({
          where: { acq_id: { in: acqUniverse } },
          select: { acq_id: true, sec: true, VehicleSpeed: true, SteeringWheelAngle: true, BrakeInfoStatus: true }
        });
        const ok = new Map<string, Set<number>>();
        for (const r of rs) {
          const speedOK = !vRange || inRange(r.VehicleSpeed ?? null, vRange[0], vRange[1]);
          const swaOK = !swaRanges.length || swaRanges.some(([lo,hi]) => inRange(r.SteeringWheelAngle ?? null, lo, hi));
          const brakeOK = !brakes.length || (r.BrakeInfoStatus && brakes.includes(r.BrakeInfoStatus));
          if (speedOK && swaOK && brakeOK) {
            if (!ok.has(r.acq_id)) ok.set(r.acq_id, new Set());
            ok.get(r.acq_id)!.add(r.sec);
          }
        }
        secondsMap = intersectSeconds(secondsMap, ok);
      }

      // ---- YOLO (y.class, y.rel_to_ego, y.conf, y.dist_m) ----
      const yClasses = splitList(q.get('y.class'));
      const yRel = splitList(q.get('y.rel_to_ego'));
      const yConfR = parseRange(q.get('y.conf'));
      const yDistR = parseRange(q.get('y.dist_m'));
      const yoloActive = !!(yClasses.length || yRel.length || yConfR || yDistR);
      if (yoloActive) {
        const rs = await prisma.yolo_1hz.findMany({
          where: {
            acq_id: { in: acqUniverse },
            ...(yClasses.length ? { class: { in: yClasses } } : {}),
            ...(yRel.length ? { rel_to_ego: { in: yRel } } : {}),
          },
          select: { acq_id: true, sec: true, conf: true, dist_m: true }
        });
        const ok = new Map<string, Set<number>>();
        for (const r of rs) {
          const confOK = !yConfR || inRange(r.conf ?? null, yConfR[0], yConfR[1]);
          const distOK = !yDistR || inRange(r.dist_m ?? null, yDistR[0], yDistR[1]);
          if (confOK && distOK) {
            if (!ok.has(r.acq_id)) ok.set(r.acq_id, new Set());
            ok.get(r.acq_id)!.add(r.sec);
          }
        }
        secondsMap = intersectSeconds(secondsMap, ok);
      }

      // ---- Overpass (o.*) ----
      const oHighwayGroups = splitList(q.get('o.highway'));
      const oLanduseGroups = splitList(q.get('o.landuse'));
      const oLanes = splitList(q.get('o.lanes'));
      const oMaxspeed = splitList(q.get('o.maxspeed'));
      const oOneway = splitList(q.get('o.oneway'));
      const oSurface = splitList(q.get('o.surface'));
      const oSidewalk = splitList(q.get('o.sidewalk'));
      const oCycleway = splitList(q.get('o.cycleway'));

      const overpassActive = !!(oHighwayGroups.length || oLanduseGroups.length || oLanes.length || oMaxspeed.length || oOneway.length || oSurface.length || oSidewalk.length || oCycleway.length);
      if (overpassActive) {
        const highwayVals = new Set<string>();
        for (const g of oHighwayGroups) (GROUPS.highway as any)[g]?.forEach((v: string) => highwayVals.add(v));
        const landuseVals = new Set<string>();
        for (const g of oLanduseGroups) (GROUPS.landuse as any)[g]?.forEach((v: string) => landuseVals.add(v));

        const rs = await prisma.overpass_1hz.findMany({
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
          select: { acq_id: true, sec: true, surface: true }
        });

        const ok = new Map<string, Set<number>>();
        for (const r of rs) {
          let surfOK = true;
          if (oSurface.length) {
            const s = (r.surface || '').toLowerCase();
            const isPaved = SURFACE_PAVED.has(s);
            const isUnpaved = SURFACE_UNPAVED.has(s);
            const wantsPaved = oSurface.includes('paved');
            const wantsUnpaved = oSurface.includes('unpaved');
            surfOK =
              (wantsPaved && isPaved) ||
              (wantsUnpaved && isUnpaved) ||
              (wantsPaved && wantsUnpaved && (isPaved || isUnpaved));
          }
          if (surfOK) {
            if (!ok.has(r.acq_id)) ok.set(r.acq_id, new Set());
            ok.get(r.acq_id)!.add(r.sec);
          }
        }
        secondsMap = intersectSeconds(secondsMap, ok);
      }

      // ---- SemSeg (s.building, s.vegetation) ----
      const sBuildTok = splitList(q.get('s.building'));
      const sVegTok   = splitList(q.get('s.vegetation'));
      const semsegActive = !!(sBuildTok.length || sVegTok.length);
      if (semsegActive) {
        const rBuild = semsegTokensToRanges(sBuildTok);
        const rVeg = semsegTokensToRanges(sVegTok);

        const rs = await prisma.semseg_1hz.findMany({
          where: { acq_id: { in: acqUniverse } },
          select: { acq_id: true, sec: true, building: true, vegetation: true }
        });

        const ok = new Map<string, Set<number>>();
        for (const r of rs) {
          const bOK = !rBuild.length || inAnyRange(r.building ?? null, rBuild);
          const vOK = !rVeg.length || inAnyRange(r.vegetation ?? null, rVeg);
          if (bOK && vOK) {
            if (!ok.has(r.acq_id)) ok.set(r.acq_id, new Set());
            ok.get(r.acq_id)!.add(r.sec);
          }
        }
        secondsMap = intersectSeconds(secondsMap, ok);
      }

      // Nenhum filtro 1Hz: aceitar todos os segundos existentes em links.jpg
      if (!secondsMap) {
        secondsMap = new Map<string, Set<number>>();
        const photos = await prisma.links.findMany({
          where: { acq_id: { in: acqUniverse }, ext: 'jpg' },
          select: { acq_id: true, sec: true }
        });
        for (const p of photos) {
          if (p.sec == null) continue;
          if (!secondsMap.has(p.acq_id)) secondsMap.set(p.acq_id, new Set());
          secondsMap.get(p.acq_id)!.add(p.sec);
        }
      }

      const matchedAcq = [...secondsMap.keys()].filter(k => secondsMap!.get(k)!.size > 0);
      const matchedSecondsCount = [...secondsMap.values()].reduce((s, set) => s + set.size, 0);

      if (!matchedAcq.length && (laneFiltersActive || canActive || yoloActive || overpassActive || semsegActive)) {
        return {
          filters_echo: echoParams(q),
          counts: { matched_acq_ids: 0, matched_seconds: 0, total_links: 0 },
          page_info: { page, per_page: perPage, has_more: false },
          documents: [],
        };
      }

      const finalAcq = matchedAcq.length ? matchedAcq : acqUniverse;

      // Puxa todos os links dessas acquisições
      const allLinks = await prisma.links.findMany({
        where: { acq_id: { in: finalAcq } },
        select: { acq_id: true, sec: true, ext: true, link: true },
      });

      // Mantém: (sec == null) sempre; (sec != null) só se estiver no set do acq_id
      const filteredDocs = allLinks.filter(doc => {
        if (doc.sec == null) return true;
        const set = secondsMap!.get(doc.acq_id);
        return set ? set.has(doc.sec) : false;
      });

      // Ordena (acq_id, sec null primeiro, depois sec crescente)
      filteredDocs.sort((a, b) => {
        if (a.acq_id !== b.acq_id) return a.acq_id < b.acq_id ? -1 : 1;
        if (a.sec == null && b.sec == null) return 0;
        if (a.sec == null) return -1;
        if (b.sec == null) return 1;
        return a.sec - b.sec;
      });

      // ===== Filtro final: limitar 5 imagens (ext=jpg) por acq_id, com amostragem uniforme =====
      const MAX_IMG_PER_ACQ = 5;
      const byAcq = new Map<string, typeof filteredDocs>();
      for (const d of filteredDocs) {
        if (!byAcq.has(d.acq_id)) byAcq.set(d.acq_id, []);
        byAcq.get(d.acq_id)!.push(d);
      }

      const limitedDocs: typeof filteredDocs = [];
      for (const [acq, docs] of byAcq.entries()) {
        const images = docs.filter(d => (d.ext?.toLowerCase?.() === 'jpg'));
        const nonImages = docs.filter(d => (d.ext?.toLowerCase?.() !== 'jpg'));

        let keptImages = images;
        if (images.length > MAX_IMG_PER_ACQ) {
          keptImages = sampleEvenly(images, MAX_IMG_PER_ACQ);
          keptImages.sort((a, b) => {
            if (a.sec == null && b.sec == null) return 0;
            if (a.sec == null) return -1;
            if (b.sec == null) return 1;
            return a.sec - b.sec;
          });
        }

        const merged = [...nonImages, ...keptImages];
        merged.sort((a, b) => {
          if (a.sec == null && b.sec == null) return 0;
          if (a.sec == null) return -1;
          if (b.sec == null) return 1;
          return a.sec - b.sec;
        });

        limitedDocs.push(...merged);
      }

      // Reordena entre acquisições
      limitedDocs.sort((a, b) => {
        if (a.acq_id !== b.acq_id) return a.acq_id < b.acq_id ? -1 : 1;
        if (a.sec == null && b.sec == null) return 0;
        if (a.sec == null) return -1;
        if (b.sec == null) return 1;
        return a.sec - b.sec;
      });

      const totalLinks = limitedDocs.length;
      const start = (page - 1) * perPage;
      const end = Math.min(start + perPage, totalLinks);
      const pageDocs = limitedDocs.slice(start, end);

      return {
        filters_echo: echoParams(q),
        counts: {
          matched_acq_ids: finalAcq.length,
          matched_seconds: matchedSecondsCount,
          total_links: totalLinks,
        },
        page_info: {
          page,
          per_page: perPage,
          has_more: end < totalLinks,
        },
        documents: pageDocs.map(d => ({
          acq_id: d.acq_id,
          sec: d.sec ?? null,
          ext: d.ext,
          link: d.link,
        })),
      };
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Interseção entre segundos: se base=null, vira a outra; senão intersecta por acq_id e por sec
function intersectSeconds(
  base: Map<string, Set<number>> | null,
  next: Map<string, Set<number>>
): Map<string, Set<number>> {
  if (!base) return next;
  const out = new Map<string, Set<number>>();
  for (const [acq, setA] of base.entries()) {
    const setB = next.get(acq);
    if (!setB) continue;
    const inter = new Set<number>();
    for (const s of setA) if (setB.has(s)) inter.add(s);
    if (inter.size) out.set(acq, inter);
  }
  return out;
}

// Ecoa os filtros (útil pro front)
function echoParams(q: URLSearchParams) {
  const keys = ["b.vehicle","b.period","b.condition","l.left_disp","l.right_disp",
    "c.VehicleSpeed","c.SteeringWheelAngle","c.BrakeInfoStatus",
    "o.highway","o.landuse","o.lanes","o.maxspeed","o.oneway","o.surface","o.sidewalk","o.cycleway",
    "s.building","s.vegetation",
    "y.class","y.rel_to_ego","y.conf","y.dist_m","page","per_page"
  ];
  const out: Record<string, any> = { b:{}, c:{}, l:{}, o:{}, s:{}, y:{} };
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
