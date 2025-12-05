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
                const user = request.user;
                if (!user) {
                    return reply.status(401).send({ error: "Unauthorized." });
                }
                const { collectionId } = request.params;
                const { testName, llmModel, promptType } = request.query;
                if (!testName) {
                    return reply
                        .status(400)
                        .send({ error: "testName is required." });
                }
                const service = new ListLLMResponsesService_1.ListLLMResponsesService();
                const data = yield service.execute(user.id, collectionId, {
                    testName,
                    llmModel,
                    promptType,
                });
                return reply.status(200).send({ data });
            }
            catch (err) {
                console.error("[ListLLMResponsesController] Error:", err);
                if (err.message === "COLLECTION_NOT_FOUND_OR_FORBIDDEN") {
                    return reply
                        .status(404)
                        .send({ error: "Collection not found or not allowed." });
                }
                return reply
                    .status(500)
                    .send({ error: "Error listing LLM responses." });
            }
        });
    }
}
exports.ListLLMResponsesController = ListLLMResponsesController;
