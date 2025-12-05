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
// src/services/LLMResult/ListLLMTestsService.ts
const prisma_1 = __importDefault(require("../../prisma"));
class ListLLMTestsService {
    execute({ collectionId }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!collectionId) {
                throw new Error("COLLECTION_ID_REQUIRED");
            }
            const grouped = yield prisma_1.default.lLMResult.groupBy({
                by: ["testName", "llmModel", "promptType"],
                where: {
                    collectionId,
                },
                _count: { _all: true },
                _min: { createdAt: true },
            });
            console.log("[ListLLMTestsService] groupBy result length:", grouped.length);
            console.log("[ListLLMTestsService] sample:", grouped[0]);
            return grouped.map((g) => ({
                testName: g.testName,
                llmModel: g.llmModel,
                promptType: g.promptType,
                docsCount: g._count._all, // <- nome que o front espera
                firstCreatedAt: g._min.createdAt,
            }));
        });
    }
}
exports.ListLLMTestsService = ListLLMTestsService;
