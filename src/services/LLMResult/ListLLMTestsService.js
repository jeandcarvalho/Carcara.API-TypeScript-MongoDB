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
exports.ListLLMTestsService = void 0;
const prisma_1 = __importDefault(require("../../prisma"));
class ListLLMTestsService {
    execute(userId, collectionId) {
        return __awaiter(this, void 0, void 0, function* () {
            // garante que a coleção é do usuário
            const collection = yield prisma_1.default.collection.findFirst({
                where: {
                    id: collectionId,
                    userId,
                },
            });
            if (!collection) {
                throw new Error("COLLECTION_NOT_FOUND_OR_FORBIDDEN");
            }
            const grouped = yield prisma_1.default.lLMResult.groupBy({
                by: ["testName", "llmModel", "promptType"],
                where: {
                    collectionId,
                },
                _count: { _all: true },
                _min: { createdAt: true },
            });
            return grouped.map((g) => ({
                testName: g.testName,
                llmModel: g.llmModel,
                promptType: g.promptType,
                totalDocs: g._count._all,
                createdAt: g._min.createdAt,
            }));
        });
    }
}
exports.ListLLMTestsService = ListLLMTestsService;
