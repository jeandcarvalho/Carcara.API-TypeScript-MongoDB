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
exports.UpsertLLMTestEvalController = void 0;
const UpsertLLMTestEvalService_1 = require("../../services/Evaluation/UpsertLLMTestEvalService");
class UpsertLLMTestEvalController {
    handle(request, reply) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = request.user;
                if (!user) {
                    return reply.status(401).send({ error: "Unauthorized." });
                }
                const body = request.body;
                const { collectionId, email, // email do usuário logado vindo do front (opcional se vier do token)
                userName, // nome do usuário logado vindo do front (opcional se vier do token)
                acq_id, sec, testName, llmModel, promptType, test1, test2, test3, test4, test5, } = body;
                if (!collectionId || !acq_id || sec === undefined ||
                    !testName || !llmModel || !promptType) {
                    return reply.status(400).send({ error: "Missing required fields." });
                }
                // converte / valida inteiros
                const secNum = Number(sec);
                const t1 = Number(test1);
                const t2 = Number(test2);
                const t3 = Number(test3);
                const t4 = Number(test4);
                const t5 = Number(test5);
                const allInts = [secNum, t1, t2, t3, t4, t5].every((v) => Number.isInteger(v));
                if (!allInts) {
                    return reply.status(400).send({ error: "sec and tests must be integers." });
                }
                const inRange = [t1, t2, t3, t4, t5].every((v) => v >= 0 && v <= 5);
                if (!inRange) {
                    return reply.status(400).send({ error: "Tests must be between 0 and 5." });
                }
                // tenta pegar email e nome do token; se não tiver, usa o que veio no body
                const userEmail = (_a = user.email) !== null && _a !== void 0 ? _a : email;
                const userNameFinal = (_b = user.name) !== null && _b !== void 0 ? _b : userName;
                if (!userEmail || !userNameFinal) {
                    return reply
                        .status(400)
                        .send({ error: "User email and name are required." });
                }
                const service = new UpsertLLMTestEvalService_1.UpsertLLMTestEvalService();
                const result = yield service.execute({
                    collectionId: String(collectionId),
                    userEmail: String(userEmail),
                    userName: String(userNameFinal),
                    acq_id: String(acq_id),
                    sec: secNum,
                    testName: String(testName),
                    llmModel: String(llmModel),
                    promptType: String(promptType),
                    test1: t1,
                    test2: t2,
                    test3: t3,
                    test4: t4,
                    test5: t5,
                });
                return reply.send(result);
            }
            catch (err) {
                console.error("[UpsertLLMTestEvalController] Error:", err);
                return reply.status(500).send({ error: "Error saving LLM test eval." });
            }
        });
    }
}
exports.UpsertLLMTestEvalController = UpsertLLMTestEvalController;
