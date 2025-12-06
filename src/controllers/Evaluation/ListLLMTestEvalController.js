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
exports.ListLLMTestEvalController = void 0;
const ListLLMTestEvalService_1 = require("../../services/Evaluation/ListLLMTestEvalService");
const prisma_1 = __importDefault(require("../../prisma"));
class ListLLMTestEvalController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const authUser = request.user;
                if (!authUser || !authUser.id) {
                    return reply.status(401).send({ error: "Unauthorized." });
                }
                // pega email/name a partir do id do token
                const dbUser = yield prisma_1.default.user.findUnique({
                    where: { id: authUser.id },
                });
                if (!dbUser || !dbUser.email) {
                    return reply
                        .status(400)
                        .send({ error: "User email and name are required." });
                }
                const userEmail = dbUser.email;
                const userNameFinal = dbUser.name || dbUser.email;
                const query = request.query;
                const { collectionId, testName, llmModel, promptType } = query;
                if (!collectionId || !testName || !llmModel || !promptType) {
                    return reply.status(400).send({
                        error: "collectionId, testName, llmModel and promptType are required in query.",
                    });
                }
                const service = new ListLLMTestEvalService_1.ListLLMTestEvalService();
                const result = yield service.execute({
                    collectionId: String(collectionId),
                    userEmail: String(userEmail),
                    userName: String(userNameFinal),
                    testName: String(testName),
                    llmModel: String(llmModel),
                    promptType: String(promptType),
                });
                return reply.send(result);
            }
            catch (err) {
                console.error("[ListLLMTestEvalController] Error:", err);
                return reply
                    .status(500)
                    .send({ error: "Error listing LLM test evals." });
            }
        });
    }
}
exports.ListLLMTestEvalController = ListLLMTestEvalController;
