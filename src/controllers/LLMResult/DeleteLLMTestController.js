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
exports.DeleteLLMTestController = void 0;
const DeleteLLMTestService_1 = require("../../services/LLMResult/DeleteLLMTestService");
class DeleteLLMTestController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = request.user;
                const { collectionId } = request.params;
                const { testName, llmModel, promptType } = request.query;
                if (!user) {
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
                const service = new DeleteLLMTestService_1.DeleteLLMTestService();
                const result = yield service.execute({
                    collectionId,
                    testName,
                    llmModel,
                    promptType,
                });
                return reply.send(Object.assign({ success: true }, result));
            }
            catch (err) {
                console.error("[DeleteLLMTestController] Error:", err);
                return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
            }
        });
    }
}
exports.DeleteLLMTestController = DeleteLLMTestController;
