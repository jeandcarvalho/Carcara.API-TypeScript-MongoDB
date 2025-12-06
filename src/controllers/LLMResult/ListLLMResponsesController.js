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
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🔓 endpoint agora é público – não exige mais user / auth
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
                const first = allResults[0];
                const meta = first
                    ? {
                        testName: first.testName,
                        llmModel: first.llmModel,
                        promptType: first.promptType,
                        // se quiser expor um "prompt padrão" para o header da página:
                        prompt: (_a = first.prompt) !== null && _a !== void 0 ? _a : null,
                    }
                    : {
                        testName,
                        llmModel: llmModel !== null && llmModel !== void 0 ? llmModel : null,
                        promptType: promptType !== null && promptType !== void 0 ? promptType : null,
                        prompt: null,
                    };
                // ✅ agora mandamos os docs completos da página selecionada
                // (acq_id, sec, prompt, response, tokens, latency, createdAt, etc)
                const items = allResults.slice(start, end);
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
