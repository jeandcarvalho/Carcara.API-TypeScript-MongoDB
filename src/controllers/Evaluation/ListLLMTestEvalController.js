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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListLLMTestEvalController = void 0;
const ListLLMTestEvalService_1 = require("../../services/Evaluation/ListLLMTestEvalService");
class ListLLMTestEvalController {
    handle(request, reply) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = request.user;
                if (!user) {
                    return reply.status(401).send({ error: "Unauthorized." });
                }
                const query = request.query;
                const { collectionId, email, userName, testName, llmModel, promptType, } = query;
                if (!collectionId ||
                    !testName ||
                    !llmModel ||
                    !promptType) {
                    return reply.status(400).send({
                        error: "collectionId, testName, llmModel and promptType are required in query.",
                    });
                }
                // mesma lógica: se token tiver email/nome, prioriza ele; senão, usa query
                const userEmail = (_a = user.email) !== null && _a !== void 0 ? _a : email;
                const userNameFinal = (_b = user.name) !== null && _b !== void 0 ? _b : userName;
                if (!userEmail || !userNameFinal) {
                    return reply
                        .status(400)
                        .send({ error: "User email and name are required." });
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
