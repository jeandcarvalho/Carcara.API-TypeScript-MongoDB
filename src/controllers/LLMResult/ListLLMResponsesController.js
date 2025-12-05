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
                    return reply.status(401).send({ error: "UNAUTHORIZED" });
                }
                const { collectionId } = request.params;
                const { testName, llmModel, promptType, page, pageSize, } = request.query;
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
                const pageNum = Number(page) && Number(page) > 0 ? Number(page) : 1;
                const pageSizeNum = Number(pageSize) && Number(pageSize) > 0
                    ? Math.min(Number(pageSize), 200)
                    : 20;
                const service = new ListLLMResponsesService_1.ListLLMResponsesService();
                const allResults = yield service.execute({
                    collectionId,
                    testName,
                    llmModel,
                    promptType,
                });
                const total = allResults.length;
                const start = (pageNum - 1) * pageSizeNum;
                const end = start + pageSizeNum;
                // meta: pega do primeiro doc; se não tiver, usa query
                const meta = allResults[0]
                    ? {
                        testName: allResults[0].testName,
                        llmModel: allResults[0].llmModel,
                        promptType: allResults[0].promptType,
                        // prompt: allResults[0].prompt,
                    }
                    : {
                        testName,
                        llmModel: llmModel !== null && llmModel !== void 0 ? llmModel : null,
                        promptType: promptType !== null && promptType !== void 0 ? promptType : null,
                        // prompt: null,
                    };
                // items: só acq_id + sec (como você pediu)
                const items = allResults.slice(start, end).map((r) => ({
                    acq_id: r.acq_id,
                    sec: r.sec,
                }));
                return reply.send(Object.assign({ items,
                    total, page: pageNum, pageSize: pageSizeNum }, meta));
            }
            catch (err) {
                console.error("[ListLLMResponsesController] Error:", err);
                return reply
                    .status(500)
                    .send({ error: "INTERNAL_SERVER_ERROR" });
            }
        });
    }
}
exports.ListLLMResponsesController = ListLLMResponsesController;
