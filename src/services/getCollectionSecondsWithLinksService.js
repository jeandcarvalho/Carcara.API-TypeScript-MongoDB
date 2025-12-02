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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionSecondsWithLinksService = void 0;
// src/services/getCollectionSecondsWithLinksService.ts
const prisma_1 = __importDefault(require("../prisma"));
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
/**
 * Normaliza um acq_id para o formato "canônico" (preferencialmente compacto YYYYMMDDHHMMSS).
 *
 * Exemplos:
 *  - "20250121202200"          -> "20250121202200"
 *  - "Recorder_2025-01-03_14-13-56" -> "20250103141356"
 *  - "qualquer_coisa"          -> "qualquer_coisa" (fallback, mas ajuda a debugar)
 */
function normalizeToCompact(acqId) {
    if (!acqId)
        return acqId;
    // 1) Já está no formato compacto? (14 dígitos)
    if (/^\d{14}$/.test(acqId)) {
        return acqId;
    }
    // 2) Padrão "Recorder_YYYY-MM-DD_HH-MM-SS"
    const match = acqId.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
    if (match) {
        const [_, year, month, day, hour, minute, second] = match;
        return `${year}${month}${day}${hour}${minute}${second}`;
    }
    // 3) Tentativa genérica: extrair só dígitos
    const onlyDigits = acqId.replace(/\D/g, "");
    if (onlyDigits.length === 14) {
        return onlyDigits;
    }
    // 4) Fallback: retorna como veio (útil para log/debug)
    return acqId;
}
/**
 * Converte um acq_id compacto (YYYYMMDDHHMMSS) para o formato "Recorder_YYYY-MM-DD_HH-MM-SS".
 *
 * Exemplo:
 *  - "20250103141356" -> "Recorder_2025-01-03_14-13-56"
 */
function compactToRecorder(compact) {
    if (!/^\d{14}$/.test(compact))
        return null;
    const year = compact.slice(0, 4);
    const month = compact.slice(4, 6);
    const day = compact.slice(6, 8);
    const hour = compact.slice(8, 10);
    const minute = compact.slice(10, 12);
    const second = compact.slice(12, 14);
    return `Recorder_${year}-${month}-${day}_${hour}-${minute}-${second}`;
}
/**
 * Retorna, para uma coleção de um usuário, todos os (acq_id, sec) existentes
 * e anexa os links correspondentes da collection `links`:
 *
 * - images: apenas extensões de imagem (jpg/png/webp/gif) com sec definido.
 * - files: demais extensões (csv/mf4/blf/avi/etc.), agregadas por acq_id.
 *
 * Faz tratamento de acq_id em formatos diferentes:
 *  - collectionItem.acq_id pode vir compacto (YYYYMMDDHHMMSS)
 *  - links.acq_id pode vir como "Recorder_YYYY-MM-DD_HH-MM-SS"
 * Ambos são unificados internamente para uma chave canônica.
 */
function getCollectionSecondsWithLinksService(userId, collectionId) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        // 1) Validar se a coleção existe e pertence ao usuário
        const collection = yield prisma_1.default.collection.findFirst({
            where: {
                id: collectionId,
                userId,
            },
            select: {
                id: true,
                name: true,
                description: true,
            },
        });
        if (!collection) {
            return null;
        }
        // 2) Buscar todos os items da coleção (acq_id + sec)
        const rawItems = yield prisma_1.default.collectionItem.findMany({
            where: {
                collectionId: collectionId,
            },
            select: {
                acq_id: true,
                sec: true,
            },
        });
        if (rawItems.length === 0) {
            return {
                collectionId: collection.id,
                name: collection.name,
                description: collection.description,
                items: [],
            };
        }
        // 3) Agrupar segundos por acq_id "canônico" (normalizado)
        const secsByAcq = new Map();
        for (const item of rawItems) {
            const acqIdRaw = item.acq_id;
            const sec = item.sec;
            // se por algum motivo vier null/undefined, ignora
            if (sec === null || sec === undefined)
                continue;
            const canonicalAcqId = normalizeToCompact(acqIdRaw);
            if (!secsByAcq.has(canonicalAcqId)) {
                secsByAcq.set(canonicalAcqId, new Set());
            }
            secsByAcq.get(canonicalAcqId).add(sec);
        }
        const canonicalAcqIds = Array.from(secsByAcq.keys());
        // 4) Montar a lista de acq_id para buscar na collection `links`
        //    - inclui o formato canônico (compacto ou não)
        //    - e, se possível, a variante "Recorder_YYYY-MM-DD_HH-MM-SS"
        const searchAcqIdsSet = new Set();
        for (const canonical of canonicalAcqIds) {
            searchAcqIdsSet.add(canonical);
            const recorderVariant = compactToRecorder(canonical);
            if (recorderVariant) {
                searchAcqIdsSet.add(recorderVariant);
            }
        }
        const searchAcqIds = Array.from(searchAcqIdsSet);
        // LOG para verificar quais acq_id estão sendo usados na busca
        console.log("[seconds-with-links] searching links for acq_ids:", {
            canonicalAcqIds,
            searchAcqIds,
        });
        // 5) Buscar todos os links correspondentes a esses acq_id na collection `links`
        const linksDocs = yield prisma_1.default.links.findMany({
            where: {
                acq_id: { in: searchAcqIds },
            },
            select: {
                acq_id: true,
                sec: true,
                ext: true,
                link: true,
            },
        });
        // LOG para ver o que está vindo da collection `links`
        console.log("[seconds-with-links] linksDocs count:", linksDocs.length);
        if (linksDocs.length > 0) {
            console.log("[seconds-with-links] sample of linksDocs (up to 5):", linksDocs.slice(0, 5));
        }
        else {
            console.log("[seconds-with-links] no links found for these acq_ids (check formats).");
        }
        // 6) Mapear links em dois mapas: imagens e arquivos, indexados por acq_id "canônico"
        const imagesByAcq = new Map();
        const filesByAcq = new Map();
        for (const doc of linksDocs) {
            const acqIdFromLinks = doc.acq_id;
            const sec = (_a = doc.sec) !== null && _a !== void 0 ? _a : null;
            // Normaliza o acq_id vindo dos links para a mesma chave usada em secsByAcq
            const canonicalAcqId = normalizeToCompact(acqIdFromLinks);
            // Se esse acq_id não existe em secsByAcq, pode ser de outra coisa; ignora
            if (!secsByAcq.has(canonicalAcqId)) {
                continue;
            }
            // Normaliza extensão: lowercase e sem ponto
            const rawExt = doc.ext || "";
            const normalizedExt = rawExt.toLowerCase().replace(/^\./, "");
            const baseFile = {
                ext: normalizedExt,
                link: doc.link,
            };
            // Se for imagem e tiver sec, vai pra lista de imagens
            if (sec !== null && IMAGE_EXTS.has(normalizedExt)) {
                if (!imagesByAcq.has(canonicalAcqId)) {
                    imagesByAcq.set(canonicalAcqId, []);
                }
                imagesByAcq.get(canonicalAcqId).push({
                    sec,
                    ext: normalizedExt,
                    link: doc.link,
                });
            }
            else {
                // Demais arquivos vão para "files" (um conjunto por acq_id canônico)
                if (!filesByAcq.has(canonicalAcqId)) {
                    filesByAcq.set(canonicalAcqId, []);
                }
                const existing = filesByAcq.get(canonicalAcqId);
                const alreadyExists = existing.some((f) => f.ext === baseFile.ext && f.link === baseFile.link);
                if (!alreadyExists) {
                    existing.push(baseFile);
                }
            }
        }
        // 7) Construir o array final de items por acq_id canônico
        const items = [];
        // Ordena acq_id para ter uma navegação previsível
        const sortedCanonicalAcqIds = Array.from(secsByAcq.keys()).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
        for (const canonicalAcqId of sortedCanonicalAcqIds) {
            const secsSet = secsByAcq.get(canonicalAcqId);
            if (!secsSet)
                continue;
            const secsArray = Array.from(secsSet).sort((a, b) => a - b);
            // Filtra imagens somente para os secs que estão na coleção
            const allImages = imagesByAcq.get(canonicalAcqId) || [];
            const filteredImages = allImages
                .filter((img) => secsSet.has(img.sec))
                .sort((a, b) => a.sec - b.sec);
            const files = filesByAcq.get(canonicalAcqId) || [];
            items.push({
                acq_id: canonicalAcqId,
                secs: secsArray,
                images: filteredImages,
                files,
            });
        }
        return {
            collectionId: collection.id,
            name: collection.name,
            description: collection.description,
            items,
        };
    });
}
exports.getCollectionSecondsWithLinksService = getCollectionSecondsWithLinksService;
