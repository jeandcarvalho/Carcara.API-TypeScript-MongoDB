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
exports.ListLLMResponsesService = void 0;
// src/services/ListLLMResponsesService.ts
const prisma_1 = __importDefault(require("../../prisma"));
class ListLLMResponsesService {
    execute({ collectionId, testName, llmModel, promptType, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!collectionId) {
                throw new Error("COLLECTION_ID_REQUIRED");
            }
            if (!testName) {
                throw new Error("TEST_NAME_REQUIRED");
            }
            const where = {
                collectionId,
                testName,
            };
            if (llmModel)
                where.llmModel = llmModel;
            if (promptType)
                where.promptType = promptType;
            const results = yield prisma_1.default.lLMResult.findMany({
                where,
                select: {
                    id: true,
                    acq_id: true,
                    sec: true,
                    llmModel: true,
                    testName: true,
                    promptType: true,
                    createdAt: true,
                },
                orderBy: [
                    { acq_id: "asc" },
                    { sec: "asc" },
                ],
            });
            return results;
        });
    }
}
exports.ListLLMResponsesService = ListLLMResponsesService;
