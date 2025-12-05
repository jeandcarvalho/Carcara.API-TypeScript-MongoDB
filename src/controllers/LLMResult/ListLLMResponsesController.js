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
exports.ListLLMResponsesController = void 0;
const ListLLMResponsesService_1 = require("../../services/LLMResult/ListLLMResponsesService");
class ListLLMResponsesController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = request.user_id;
                const { collectionId } = request.params;
                const { testName, llmModel, promptType } = request.query;
                if (!userId) {
                    return reply.status(401).send({ error: "UNAUTHORIZED" });
                }
                if (!collectionId) {
                    return reply
                        .status(400)
                        .send({ error: "COLLECTION_ID_REQUIRED" });
                }
                if (!testName) {
                    return reply
                        .status(400)
                        .send({ error: "TEST_NAME_REQUIRED" });
                }
                const service = new ListLLMResponsesService_1.ListLLMResponsesService();
                const data = yield service.execute({
                    collectionId,
                    testName,
                    llmModel,
                    promptType,
                });
                return reply.send({ data });
            }
            catch (err) {
                console.error("[ListLLMResponsesController] Error:", err);
                return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
            }
        });
    }
}
exports.ListLLMResponsesController = ListLLMResponsesController;
