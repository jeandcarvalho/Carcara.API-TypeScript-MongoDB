"use strict";
// src/services/GetCollectionSecondsWithLinksService.ts
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
// Extensões consideradas imagens — precisam bater com acq_id + sec
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
function getCollectionSecondsWithLinksService(userId, collectionId) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        // 1. Verificar se a coleção existe e pertence ao usuário
        const collection = yield prisma_1.default.collection.findFirst({
            where: { id: collectionId, userId },
            select: {
                id: true,
                name: true,
                description: true,
            },
        });
        if (!collection) {
            return null;
        }
        // 2. Buscar todos os items (acq_id + sec) da coleção
        const rawItems = yield prisma_1.default.collectionItem.findMany({
            where: { collectionId },
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
        // 3. Agrupar segundos por acq_id
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
        // 4. Buscar todos os links no Mongo (coleção "links")
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
        // 5. Organizar links em:
        //    imagesByAcq: imagens (precisam bater acq_id + sec)
        //    filesByAcq: outros formatos (avi, csv, mf4, blf...) apenas 1 por ext
        const imagesByAcq = new Map();
        const filesByAcq = new Map();
        for (const doc of linksDocs) {
            const acqId = doc.acq_id;
            const ext = (doc.ext || "").toLowerCase();
            const sec = (_a = doc.sec) !== null && _a !== void 0 ? _a : null;
            const secsSet = secsByAcq.get(acqId);
            if (!secsSet)
                continue;
            if (IMAGE_EXTS.has(ext)) {
                // Imagens precisam bater com sec da coleção
                if (sec === null)
                    continue;
                if (!secsSet.has(sec))
                    continue;
                const imagesList = (_b = imagesByAcq.get(acqId)) !== null && _b !== void 0 ? _b : [];
                imagesList.push({
                    sec,
                    ext,
                    link: doc.link,
                });
                imagesByAcq.set(acqId, imagesList);
            }
            else {
                // Arquivos não-imagem: um por extensão por acq_id
                let filesList = filesByAcq.get(acqId);
                if (!filesList) {
                    filesList = [];
                    filesByAcq.set(acqId, filesList);
                }
                const exists = filesList.some((f) => f.ext === ext);
                if (!exists) {
                    filesList.push({
                        ext,
                        link: doc.link,
                    });
                }
            }
        }
        // 6. Montar resposta final no formato esperado
        const items = [];
        for (const [acqId, secsSet] of secsByAcq.entries()) {
            const secs = Array.from(secsSet).sort((a, b) => a - b);
            const images = (_c = imagesByAcq.get(acqId)) !== null && _c !== void 0 ? _c : [];
            const files = (_d = filesByAcq.get(acqId)) !== null && _d !== void 0 ? _d : [];
            items.push({
                acq_id: acqId,
                secs,
                images,
                files,
            });
        }
        // Ordena por acq_id para consistência
        items.sort((a, b) => (a.acq_id < b.acq_id ? -1 : a.acq_id > b.acq_id ? 1 : 0));
        return {
            collectionId: collection.id,
            name: collection.name,
            description: collection.description,
            items,
        };
    });
}
exports.getCollectionSecondsWithLinksService = getCollectionSecondsWithLinksService;
