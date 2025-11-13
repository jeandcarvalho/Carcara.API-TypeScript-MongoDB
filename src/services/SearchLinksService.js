"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchLinksService = void 0;
// services/SearchLinksService.ts
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Número máximo de imagens (jpg) por aquisição
const MAX_IMG_PER_ACQ = 5;
// Helper de tempo/log
function stamp(label, prev, extra) {
    const now = Date.now();
    const delta = now - prev;
    console.log(`[SearchLinksService] ${label} ${extra ? `(${extra})` : ''} +${delta}ms`);
    return now;
}
// ===== Helpers de parsing (iguais ao front) =====
function splitList(v) {
    if (!v)
        return [];
    return v.split(',').map(s => s.trim()).filter(Boolean);
}
function parseRange(tok) {
    if (!tok)
        return undefined;
    const [a, b] = tok.split('..');
    const lo = a === '' || a === undefined ? undefined : Number(a);
    const hi = b === '' || b === undefined ? undefined : Number(b);
    if (Number.isNaN(lo) && Number.isNaN(hi))
        return undefined;
    return [lo, hi];
}
function inRange(numStr, lo, hi) {
    if (numStr == null || numStr === '')
        return false;
    const x = Number(numStr);
    if (!Number.isFinite(x))
        return false;
    if (lo !== undefined && x < lo)
        return false;
    if (hi !== undefined && x > hi)
        return false;
    return true;
}
// ====== Grupos Overpass (espelham o front) ======
const GROUPS = {
    highway: {
        primary: ["motorway", "trunk", "primary"],
        primary_link: ["motorway_link", "trunk_link", "primary_link"],
        secondary: ["secondary", "tertiary"],
        secondary_link: ["secondary_link", "tertiary_link"],
        local: ["residential", "living_street", "unclassified", "service", "services", "platform", "pedestrian", "footway", "steps", "path", "cycleway", "busway", "track"],
    },
    landuse: {
        residential: ["residential", "village_green"],
        commercial: ["commercial", "retail"],
        industrial: ["industrial", "garages", "storage", "landfill"],
        agro: ["farmland", "farmyard", "orchard", "meadow"],
        green: ["forest", "grass", "scrub", "recreation", "recreation_ground", "cemetery", "flowerbed", "greenfield"],
    }
};
// Surface → grupos (paved/unpaved) para `o.surface`
const SURFACE_PAVED = new Set(["asphalt", "paved", "concrete", "concrete_plates", "paving_stones", "sett", "cement"]);
const SURFACE_UNPAVED = new Set(["unpaved", "compacted", "gravel", "fine_gravel", "dirt", "earth", "ground", "pebblestone", "grass", "sand", "mud", "soil", "clay"]);
// SemSeg thresholds (mesmos valores da UI)
const SEMSEG = {
    building: { p25: 0.0, median: 0.68, p75: 8.72 },
    vegetation: { p25: 23.99, median: 40.14, p75: 59.41 },
};
// Converte chips de semseg do front ("..p25", "p25..p75", "p75..")
// para um array de ranges numéricos
function semsegTokensToRanges(tokens) {
    const ranges = [];
    for (const t of tokens) {
        const r = parseRange(t);
        if (r)
            ranges.push(r);
    }
    return ranges;
}
// Faz OR entre ranges: true se o valor cair em qualquer range
function inAnyRange(numStr, ranges) {
    if (!ranges.length)
        return true;
    return ranges.some(([lo, hi]) => inRange(numStr, lo, hi));
}
// Amostragem uniforme (início, meio e fim bem representados)
function sampleEvenly(arr, k) {
    const n = arr.length;
    if (n <= k)
        return arr.slice();
    const idxSet = new Set();
    for (let i = 0; i < k; i++) {
        const idx = Math.round((i * (n - 1)) / (k - 1));
        idxSet.add(idx);
    }
    // Garante exatamente k elementos (caso arredondamentos gerem duplicatas)
    const out = [];
    const idxs = Array.from(idxSet).sort((a, b) => a - b);
    for (const i of idxs)
        out.push(arr[i]);
    for (let i = 0; out.length < k && i < n; i++) {
        if (!idxSet.has(i))
            out.push(arr[i]);
    }
    return out;
}
class SearchLinksService {
    /**
     * Recebe a URL da API (ex: /api/search?...), parseia os params e executa:
     * 1) blocks_5min → limita acq_id
     * 2) coleções 1Hz ativas → filtra & INTERSECTA segundos
     * 3) links → retorna documentos (sec∈set), paginados
     *    **Filtro final direto na query**: até 5 imagens (ext=jpg) por acq_id,
     *    escolhendo até 5 segundos amostrados de secondsMap (sem sec=null).
     *
     * Logs:
     *  - início da requisição
     *  - tempo e linhas de cada query
     *  - filtros aplicados
     *  - resultado final + tempo total
     */
    executeFromURL(rawUrl) {
        var _a, _b, _c, _d, _e, _f, _g;
        return __awaiter(this, void 0, void 0, function* () {
            const t0 = Date.now();
            let t = t0;
            console.log('\n[SearchLinksService] ===== New search request =====');
            console.log(`[SearchLinksService] rawUrl = ${rawUrl}`);
            try {
                const url = new URL(rawUrl, 'http://localhost'); // base dummy só pra parsear
                const q = url.searchParams;
                // ====== 0) paginação ======
                const page = Math.max(1, Number(q.get('page') || 1));
                const perPage = Math.max(1, Math.min(500, Number(q.get('per_page') || 100)));
                console.log(`[SearchLinksService] pagination: page=${page}, per_page=${perPage}`);
                // ====== 1) BLOCO 5 MIN (b.*) ======
                const bVehicle = q.get('b.vehicle') || undefined;
                const bPeriod = q.get('b.period') || undefined;
                const bCondition = q.get('b.condition') || undefined;
                const whereBlocks = {};
                if (bVehicle)
                    whereBlocks.vehicle = bVehicle;
                if (bPeriod)
                    whereBlocks.period = bPeriod;
                if (bCondition)
                    whereBlocks.condition = bCondition;
                console.log('[SearchLinksService] blocks_5min filters:', whereBlocks);
                const blocks = yield prisma.blocks_5min.findMany({
                    where: whereBlocks,
                    select: { acq_id: true },
                });
                t = stamp('blocks_5min.findMany', t, `rows=${blocks.length}`);
                const acqIds = [...new Set(blocks.map(b => b.acq_id))];
                const acqUniverse = acqIds.length
                    ? acqIds
                    : (yield prisma.blocks_5min.findMany({ select: { acq_id: true } })).map(b => b.acq_id);
                if (!acqIds.length) {
                    t = stamp('blocks_5min.findMany (fallback universe)', t, `rows=${acqUniverse.length}`);
                }
                console.log(`[SearchLinksService] acqIds (filtered) = ${acqIds.length}`);
                console.log(`[SearchLinksService] acqUniverse (used) = ${acqUniverse.length}`);
                if (!acqUniverse.length) {
                    console.log('[SearchLinksService] acqUniverse vazio, encerrando cedo.');
                    console.log(`[SearchLinksService] total elapsed = ${Date.now() - t0}ms`);
                    return {
                        filters_echo: echoParams(q),
                        counts: { matched_acq_ids: 0, matched_seconds: 0, total_links: 0 },
                        page_info: { page, per_page: perPage, has_more: false },
                        documents: [],
                    };
                }
                // ====== 2) 1Hz — coletar filtros ativos e INTERSECTAR por segundo ======
                let secondsMap = null;
                // ---- LaneEgo (l.*) ----
                const lLeft = splitList(q.get('l.left_disp'));
                const lRight = splitList(q.get('l.right_disp'));
                const laneFiltersActive = !!(lLeft.length || lRight.length);
                console.log(`[SearchLinksService] laneego filters: left=${lLeft.join('|')}, right=${lRight.join('|')}`);
                if (laneFiltersActive) {
                    const rs = yield prisma.laneego_1hz.findMany({
                        where: { acq_id: { in: acqUniverse } },
                        select: { acq_id: true, sec: true, left_disp: true, right_disp: true }
                    });
                    t = stamp('laneego_1hz.findMany', t, `rows=${rs.length}`);
                    const ok = new Map();
                    for (const r of rs) {
                        const okLeft = !lLeft.length || (r.left_disp && lLeft.includes(r.left_disp));
                        const okRight = !lRight.length || (r.right_disp && lRight.includes(r.right_disp));
                        if (okLeft && okRight) {
                            if (!ok.has(r.acq_id))
                                ok.set(r.acq_id, new Set());
                            ok.get(r.acq_id).add(r.sec);
                        }
                    }
                    secondsMap = ok;
                    console.log(`[SearchLinksService] laneego secondsMap acq_ids=${secondsMap.size}`);
                }
                // ---- CAN (c.VehicleSpeed, c.SteeringWheelAngle, c.BrakeInfoStatus) ----
                const vRange = parseRange(q.get('c.VehicleSpeed'));
                const swaTok = q.get('c.SteeringWheelAngle');
                const swaRanges = splitList(swaTok).map(tk => parseRange(tk)).filter(Boolean);
                const brakes = splitList(q.get('c.BrakeInfoStatus'));
                const canActive = !!(vRange || swaRanges.length || brakes.length);
                console.log('[SearchLinksService] CAN filters:', { vRange, swaRanges, brakes });
                if (canActive) {
                    const rs = yield prisma.can_1hz.findMany({
                        where: { acq_id: { in: acqUniverse } },
                        select: { acq_id: true, sec: true, VehicleSpeed: true, SteeringWheelAngle: true, BrakeInfoStatus: true }
                    });
                    t = stamp('can_1hz.findMany', t, `rows=${rs.length}`);
                    const ok = new Map();
                    for (const r of rs) {
                        const speedOK = !vRange || inRange((_a = r.VehicleSpeed) !== null && _a !== void 0 ? _a : null, vRange[0], vRange[1]);
                        const swaOK = !swaRanges.length || swaRanges.some(([lo, hi]) => { var _a; return inRange((_a = r.SteeringWheelAngle) !== null && _a !== void 0 ? _a : null, lo, hi); });
                        const brakeOK = !brakes.length || (r.BrakeInfoStatus && brakes.includes(r.BrakeInfoStatus));
                        if (speedOK && swaOK && brakeOK) {
                            if (!ok.has(r.acq_id))
                                ok.set(r.acq_id, new Set());
                            ok.get(r.acq_id).add(r.sec);
                        }
                    }
                    secondsMap = intersectSeconds(secondsMap, ok);
                    console.log(`[SearchLinksService] after CAN intersect: acq_ids=${secondsMap.size}`);
                }
                // ---- YOLO (y.class, y.rel_to_ego, y.conf, y.dist_m) ----
                const yClasses = splitList(q.get('y.class'));
                const yRel = splitList(q.get('y.rel_to_ego'));
                const yConfR = parseRange(q.get('y.conf'));
                const yDistR = parseRange(q.get('y.dist_m'));
                const yoloActive = !!(yClasses.length || yRel.length || yConfR || yDistR);
                console.log('[SearchLinksService] YOLO filters:', { yClasses, yRel, yConfR, yDistR });
                if (yoloActive) {
                    const rs = yield prisma.yolo_1hz.findMany({
                        where: Object.assign(Object.assign({ acq_id: { in: acqUniverse } }, (yClasses.length ? { class: { in: yClasses } } : {})), (yRel.length ? { rel_to_ego: { in: yRel } } : {})),
                        select: { acq_id: true, sec: true, conf: true, dist_m: true }
                    });
                    t = stamp('yolo_1hz.findMany', t, `rows=${rs.length}`);
                    const ok = new Map();
                    for (const r of rs) {
                        const confOK = !yConfR || inRange((_b = r.conf) !== null && _b !== void 0 ? _b : null, yConfR[0], yConfR[1]);
                        const distOK = !yDistR || inRange((_c = r.dist_m) !== null && _c !== void 0 ? _c : null, yDistR[0], yDistR[1]);
                        if (confOK && distOK) {
                            if (!ok.has(r.acq_id))
                                ok.set(r.acq_id, new Set());
                            ok.get(r.acq_id).add(r.sec);
                        }
                    }
                    secondsMap = intersectSeconds(secondsMap, ok);
                    console.log(`[SearchLinksService] after YOLO intersect: acq_ids=${secondsMap.size}`);
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
                console.log('[SearchLinksService] Overpass filters:', {
                    oHighwayGroups, oLanduseGroups, oLanes, oMaxspeed, oOneway, oSurface, oSidewalk, oCycleway
                });
                if (overpassActive) {
                    const highwayVals = new Set();
                    for (const g of oHighwayGroups)
                        (_d = GROUPS.highway[g]) === null || _d === void 0 ? void 0 : _d.forEach((v) => highwayVals.add(v));
                    const landuseVals = new Set();
                    for (const g of oLanduseGroups)
                        (_e = GROUPS.landuse[g]) === null || _e === void 0 ? void 0 : _e.forEach((v) => landuseVals.add(v));
                    const rs = yield prisma.overpass_1hz.findMany({
                        where: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ acq_id: { in: acqUniverse } }, (highwayVals.size ? { highway: { in: [...highwayVals] } } : {})), (landuseVals.size ? { landuse: { in: [...landuseVals] } } : {})), (oLanes.length ? { lanes: { in: oLanes } } : {})), (oMaxspeed.length ? { maxspeed: { in: oMaxspeed.map(String) } } : {})), (oOneway.length ? { oneway: { in: oOneway } } : {})), (oSidewalk.length ? { sidewalk: { in: oSidewalk } } : {})), (oCycleway.length ? { cycleway: { in: oCycleway } } : {})),
                        select: { acq_id: true, sec: true, surface: true }
                    });
                    t = stamp('overpass_1hz.findMany', t, `rows=${rs.length}`);
                    const ok = new Map();
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
                            if (!ok.has(r.acq_id))
                                ok.set(r.acq_id, new Set());
                            ok.get(r.acq_id).add(r.sec);
                        }
                    }
                    secondsMap = intersectSeconds(secondsMap, ok);
                    console.log(`[SearchLinksService] after Overpass intersect: acq_ids=${secondsMap.size}`);
                }
                // ---- SemSeg (s.building, s.vegetation) ----
                const sBuildTok = splitList(q.get('s.building'));
                const sVegTok = splitList(q.get('s.vegetation'));
                const semsegActive = !!(sBuildTok.length || sVegTok.length);
                console.log('[SearchLinksService] SemSeg filters:', { sBuildTok, sVegTok });
                if (semsegActive) {
                    const rBuild = semsegTokensToRanges(sBuildTok);
                    const rVeg = semsegTokensToRanges(sVegTok);
                    const rs = yield prisma.semseg_1hz.findMany({
                        where: { acq_id: { in: acqUniverse } },
                        select: { acq_id: true, sec: true, building: true, vegetation: true }
                    });
                    t = stamp('semseg_1hz.findMany', t, `rows=${rs.length}`);
                    const ok = new Map();
                    for (const r of rs) {
                        const bOK = !rBuild.length || inAnyRange((_f = r.building) !== null && _f !== void 0 ? _f : null, rBuild);
                        const vOK = !rVeg.length || inAnyRange((_g = r.vegetation) !== null && _g !== void 0 ? _g : null, rVeg);
                        if (bOK && vOK) {
                            if (!ok.has(r.acq_id))
                                ok.set(r.acq_id, new Set());
                            ok.get(r.acq_id).add(r.sec);
                        }
                    }
                    secondsMap = intersectSeconds(secondsMap, ok);
                    console.log(`[SearchLinksService] after SemSeg intersect: acq_ids=${secondsMap.size}`);
                }
                // Nenhum filtro 1Hz: aceitar todos os segundos existentes em links.jpg
                if (!secondsMap) {
                    console.log('[SearchLinksService] Nenhum filtro 1Hz ativo → usar todos segundos de links.jpg (ext=jpg, sec!=null)');
                    secondsMap = new Map();
                    const photos = yield prisma.links.findMany({
                        where: { acq_id: { in: acqUniverse }, ext: 'jpg' },
                        select: { acq_id: true, sec: true }
                    });
                    t = stamp('links.findMany (seconds fallback)', t, `rows=${photos.length}`);
                    for (const p of photos) {
                        if (p.sec == null)
                            continue;
                        if (!secondsMap.has(p.acq_id))
                            secondsMap.set(p.acq_id, new Set());
                        secondsMap.get(p.acq_id).add(p.sec);
                    }
                }
                const matchedAcq = [...secondsMap.keys()].filter(k => secondsMap.get(k).size > 0);
                const matchedSecondsCount = [...secondsMap.values()].reduce((s, set) => s + set.size, 0);
                console.log(`[SearchLinksService] matchedAcq_ids=${matchedAcq.length}, matchedSeconds=${matchedSecondsCount}`);
                const anyFilters1Hz = laneFiltersActive || canActive || yoloActive || overpassActive || semsegActive;
                if (!matchedAcq.length && anyFilters1Hz) {
                    console.log('[SearchLinksService] matchedAcq vazio após filtros 1Hz, encerrando cedo.');
                    console.log(`[SearchLinksService] total elapsed = ${Date.now() - t0}ms`);
                    return {
                        filters_echo: echoParams(q),
                        counts: { matched_acq_ids: 0, matched_seconds: 0, total_links: 0 },
                        page_info: { page, per_page: perPage, has_more: false },
                        documents: [],
                    };
                }
                const finalAcq = matchedAcq.length ? matchedAcq : acqUniverse;
                console.log(`[SearchLinksService] finalAcq_ids=${finalAcq.length}`);
                // ===== NOVO: escolher no máximo 5 segundos por acq_id (amostragem) =====
                const sampledSecondsByAcq = new Map();
                for (const acq of finalAcq) {
                    const secSet = secondsMap.get(acq);
                    if (!secSet || secSet.size === 0)
                        continue;
                    const secsSorted = [...secSet].sort((a, b) => a - b);
                    const sampled = sampleEvenly(secsSorted, MAX_IMG_PER_ACQ);
                    sampledSecondsByAcq.set(acq, sampled);
                }
                console.log('[SearchLinksService] sampledSecondsByAcq sizes:', Array.from(sampledSecondsByAcq.entries()).map(([acq, secs]) => `${acq}:${secs.length}`).join(', '));
                const orConds = [];
                for (const [acq, secs] of sampledSecondsByAcq.entries()) {
                    if (!secs.length)
                        continue;
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
                // ===== 3) Puxa apenas jpg, apenas secs amostrados (sem sec=null) =====
                const allLinks = yield prisma.links.findMany({
                    where: {
                        ext: 'jpg',
                        OR: orConds,
                    },
                    select: { acq_id: true, sec: true, ext: true, link: true },
                });
                t = stamp('links.findMany (sampled jpg only)', t, `rows=${allLinks.length}`);
                // Não precisa mais filtrar por secondsMap aqui, pois o OR já faz isso.
                const filteredDocs = allLinks.slice();
                console.log(`[SearchLinksService] filteredDocs (sampled) = ${filteredDocs.length}`);
                // Ordena (acq_id, sec crescente)
                filteredDocs.sort((a, b) => {
                    if (a.acq_id !== b.acq_id)
                        return a.acq_id < b.acq_id ? -1 : 1;
                    if (a.sec == null && b.sec == null)
                        return 0;
                    if (a.sec == null)
                        return -1;
                    if (b.sec == null)
                        return 1;
                    return a.sec - b.sec;
                });
                const totalLinks = filteredDocs.length;
                const start = (page - 1) * perPage;
                const end = Math.min(start + perPage, totalLinks);
                const pageDocs = filteredDocs.slice(start, end);
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
                        has_more: end < totalLinks,
                    },
                    documents: pageDocs.map(d => {
                        var _a;
                        return ({
                            acq_id: d.acq_id,
                            sec: (_a = d.sec) !== null && _a !== void 0 ? _a : null,
                            ext: d.ext,
                            link: d.link,
                        });
                    }),
                };
                console.log(`[SearchLinksService] RESULT counts = acq_ids=${finalAcq.length}, seconds=${matchedSecondsCount}, total_links=${totalLinks}`);
                console.log(`[SearchLinksService] page_info = page=${page}, per_page=${perPage}, docs_page=${pageDocs.length}`);
                console.log(`[SearchLinksService] total elapsed = ${Date.now() - t0}ms`);
                return result;
            }
            finally {
                yield prisma.$disconnect();
            }
        });
    }
}
exports.SearchLinksService = SearchLinksService;
// Interseção entre segundos: se base=null, vira a outra; senão intersecta por acq_id e por sec
function intersectSeconds(base, next) {
    if (!base)
        return next;
    const out = new Map();
    for (const [acq, setA] of base.entries()) {
        const setB = next.get(acq);
        if (!setB)
            continue;
        const inter = new Set();
        for (const s of setA)
            if (setB.has(s))
                inter.add(s);
        if (inter.size)
            out.set(acq, inter);
    }
    return out;
}
// Ecoa os filtros (útil pro front)
function echoParams(q) {
    const keys = ["b.vehicle", "b.period", "b.condition", "l.left_disp", "l.right_disp",
        "c.VehicleSpeed", "c.SteeringWheelAngle", "c.BrakeInfoStatus",
        "o.highway", "o.landuse", "o.lanes", "o.maxspeed", "o.oneway", "o.surface", "o.sidewalk", "o.cycleway",
        "s.building", "s.vegetation",
        "y.class", "y.rel_to_ego", "y.conf", "y.dist_m", "page", "per_page"
    ];
    const out = { b: {}, c: {}, l: {}, o: {}, s: {}, y: {} };
    for (const k of keys) {
        const v = q.get(k);
        if (!v)
            continue;
        const [ns, key] = k.split('.');
        if (key) {
            out[ns][key] = k.startsWith('c.') || k.startsWith('s.') || k.startsWith('y.') ? v : splitList(v);
        }
        else {
            out[k] = v;
        }
    }
    return out;
}
