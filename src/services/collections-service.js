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
exports.getUserCollectionsService = getUserCollectionsService;
exports.getCollectionSecsForAcqService = getCollectionSecsForAcqService;
exports.addItemsToCollectionService = addItemsToCollectionService;
exports.removeItemsFromCollectionService = removeItemsFromCollectionService;
// src/services/collections/CollectionsService.ts
const prisma_1 = __importDefault(require("../prisma"));
// ---------------------------
// 1) Listar coleções do user
// ---------------------------
function getUserCollectionsService(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const collections = (yield prisma_1.default.collection.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                _count: {
                    select: { items: true },
                },
            },
        }));
        return collections.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            createdAt: c.createdAt,
            itemsCount: c._count.items,
        }));
    });
}
// --------------------------------------------------------
// 2) Buscar secs de uma acq_id específica dentro da coleção
// --------------------------------------------------------
function getCollectionSecsForAcqService(userId, collectionId, acq_id) {
    return __awaiter(this, void 0, void 0, function* () {
        const collection = yield prisma_1.default.collection.findFirst({
            where: { id: collectionId, userId },
            select: { id: true },
        });
        if (!collection) {
            return null;
        }
        const items = (yield prisma_1.default.collectionItem.findMany({
            where: { collectionId, acq_id },
            select: { sec: true },
            orderBy: { sec: "asc" },
        }));
        return {
            collectionId,
            acq_id,
            secs: items.map((i) => i.sec),
        };
    });
}
// ----------------------------------------------------
// 3) Adicionar momentos (acq_id + sec) à coleção
// ----------------------------------------------------
function addItemsToCollectionService(userId, collectionId, items) {
    return __awaiter(this, void 0, void 0, function* () {
        const collection = yield prisma_1.default.collection.findFirst({
            where: { id: collectionId, userId },
            select: { id: true },
        });
        if (!collection) {
            return null;
        }
        // remove duplicados dentro do payload
        const unique = new Map();
        for (const item of items) {
            if (!item.acq_id || typeof item.sec !== "number")
                continue;
            const key = `${item.acq_id}:${item.sec}`;
            if (!unique.has(key)) {
                unique.set(key, item);
            }
        }
        const dataToInsert = Array.from(unique.values()).map((item) => ({
            collectionId,
            acq_id: item.acq_id,
            sec: item.sec,
        }));
        if (dataToInsert.length === 0) {
            return { inserted: 0 };
        }
        const result = yield prisma_1.default.collectionItem.createMany({
            data: dataToInsert,
            // Mongo não suporta skipDuplicates
        });
        return { inserted: result.count };
    });
}
// ----------------------------------------------------
// 4) Remover momentos (acq_id + sec) da coleção
// ----------------------------------------------------
function removeItemsFromCollectionService(userId, collectionId, items) {
    return __awaiter(this, void 0, void 0, function* () {
        const collection = yield prisma_1.default.collection.findFirst({
            where: { id: collectionId, userId },
            select: { id: true },
        });
        if (!collection) {
            return null;
        }
        const orConditions = items
            .filter((item) => item.acq_id && typeof item.sec === "number")
            .map((item) => ({
            acq_id: item.acq_id,
            sec: item.sec,
        }));
        if (orConditions.length === 0) {
            return { deleted: 0 };
        }
        const result = yield prisma_1.default.collectionItem.deleteMany({
            where: {
                collectionId,
                OR: orConditions,
            },
        });
        return { deleted: result.count };
    });
}
