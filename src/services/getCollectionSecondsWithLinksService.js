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
const prisma_1 = __importDefault(require("../prisma"));
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
/**
 * Retorna, para uma coleção de um usuário, todos os (acq_id, sec) existentes
 * e anexa os links correspondentes da collection `links`:
 *
 * - images: apenas extensões de imagem (jpg/png/webp/gif) com sec definido.
 * - files: demais extensões (csv/mf4/blf/avi/etc.), agregadas por acq_id.
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
        // 3) Agrupar segundos por acq_id
        const secsByAcq = new Map();
        for (const item of rawItems) {
            const acqId = item.acq_id;
            const sec = item.sec;
            if (!secsByAcq.has(acqId)) {
                secsByAcq.set(acqId, new Set());
            }
            secsByAcq.get(acqId).add(sec);
        }
        const acqIds = Array.from(secsByAcq.keys());
        // 4) Buscar todos os links correspondentes a esses acq_id na collection `links`
        //    (vai trazer imagens e arquivos em geral)
        const linksDocs = yield prisma_1.default.links.findMany({
            where: {
                acq_id: { in: acqIds },
            },
            select: {
                acq_id: true,
                sec: true,
                ext: true,
                link: true,
            },
        });
        // 5) Mapear links em dois mapas: imagens e arquivos, indexados por acq_id
        const imagesByAcq = new Map();
        const filesByAcq = new Map();
        for (const doc of linksDocs) {
            const acqId = doc.acq_id;
            const sec = (_a = doc.sec) !== null && _a !== void 0 ? _a : null;
            // Normaliza extensão: lowercase e sem ponto
            const rawExt = doc.ext || "";
            const normalizedExt = rawExt.toLowerCase().replace(/^\./, "");
            const baseFile = {
                ext: normalizedExt,
                link: doc.link,
            };
            // Se for imagem e tiver sec, vai pra lista de imagens
            if (sec !== null && IMAGE_EXTS.has(normalizedExt)) {
                if (!imagesByAcq.has(acqId)) {
                    imagesByAcq.set(acqId, []);
                }
                imagesByAcq.get(acqId).push({
                    sec,
                    ext: normalizedExt,
                    link: doc.link,
                });
            }
            else {
                // Demais arquivos vão para "files" (um conjunto por acq_id)
                if (!filesByAcq.has(acqId)) {
                    filesByAcq.set(acqId, []);
                }
                // Evita duplicar o mesmo ext+link várias vezes
                const existing = filesByAcq.get(acqId);
                const alreadyExists = existing.some((f) => f.ext === baseFile.ext && f.link === baseFile.link);
                if (!alreadyExists) {
                    existing.push(baseFile);
                }
            }
        }
        // 6) Construir o array final de items por acq_id
        const items = [];
        // Ordena acq_id para ter uma navegação previsível
        const sortedAcqIds = Array.from(secsByAcq.keys()).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
        for (const acqId of sortedAcqIds) {
            const secsSet = secsByAcq.get(acqId);
            if (!secsSet)
                continue;
            const secsArray = Array.from(secsSet).sort((a, b) => a - b);
            // Filtra imagens somente para os secs que estão na coleção
            const allImages = imagesByAcq.get(acqId) || [];
            const filteredImages = allImages
                .filter((img) => secsSet.has(img.sec))
                .sort((a, b) => a.sec - b.sec);
            const files = filesByAcq.get(acqId) || [];
            items.push({
                acq_id: acqId,
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
