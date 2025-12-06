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
exports.UpsertLLMTestEvalService = void 0;
// src/services/UpsertLLMTestEvalService.ts
const prisma_1 = __importDefault(require("../../prisma"));
class UpsertLLMTestEvalService {
    execute(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const { collectionId, userEmail, userName, acq_id, sec, testName, llmModel, promptType, test1, test2, test3, test4, test5, } = input;
            // 1) tenta achar um doc com o mesmo "combo"
            const existing = yield prisma_1.default.lLMTestEval.findFirst({
                where: {
                    collectionId,
                    userEmail,
                    acq_id,
                    sec,
                    testName,
                    llmModel,
                    promptType,
                },
            });
            if (existing) {
                // 2) se existir, atualiza as notas
                const updated = yield prisma_1.default.lLMTestEval.update({
                    where: {
                        id: existing.id,
                    },
                    data: {
                        userName, // atualiza nome também se mudou
                        test1,
                        test2,
                        test3,
                        test4,
                        test5,
                    },
                });
                return updated;
            }
            // 3) se não existir, cria um novo
            const created = yield prisma_1.default.lLMTestEval.create({
                data: {
                    collectionId,
                    userEmail,
                    userName,
                    acq_id,
                    sec,
                    testName,
                    llmModel,
                    promptType,
                    test1,
                    test2,
                    test3,
                    test4,
                    test5,
                },
            });
            return created;
        });
    }
}
exports.UpsertLLMTestEvalService = UpsertLLMTestEvalService;
