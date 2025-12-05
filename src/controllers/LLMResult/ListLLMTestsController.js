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
exports.ListLLMTestsController = void 0;
const ListLLMTestsService_1 = require("../../services/LLMResult/ListLLMTestsService");
class ListLLMTestsController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = request.user_id;
                const { collectionId } = request.params;
                if (!userId) {
                    return reply.status(401).send({ error: "UNAUTHORIZED" });
                }
                if (!collectionId) {
                    return reply
                        .status(400)
                        .send({ error: "COLLECTION_ID_REQUIRED" });
                }
                const service = new ListLLMTestsService_1.ListLLMTestsService();
                const tests = yield service.execute({ collectionId });
                return reply.send({ data: tests });
            }
            catch (err) {
                console.error("[ListLLMTestsController] Error:", err);
                return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
            }
        });
    }
}
exports.ListLLMTestsController = ListLLMTestsController;
