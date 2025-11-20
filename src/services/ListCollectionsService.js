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
exports.ListCollectionsService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
class ListCollectionsService {
    execute(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const collections = yield prisma_1.default.collection.findMany({
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
            });
            return collections.map((c) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                createdAt: c.createdAt,
                itemsCount: c._count.items,
            }));
        });
    }
}
exports.ListCollectionsService = ListCollectionsService;
