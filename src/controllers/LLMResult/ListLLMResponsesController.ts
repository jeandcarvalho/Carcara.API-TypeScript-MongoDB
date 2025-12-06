// src/controllers/LLMResult/ListLLMResponsesController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ListLLMResponsesService } from "../../services/LLMResult/ListLLMResponsesService";

type ListLLMResponsesParams = {
  collectionId: string;
};

type ListLLMResponsesQuery = {
  testName?: string;
  llmModel?: string;
  promptType?: string;
  page?: string;
  pageSize?: string;
};

export class ListLLMResponsesController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      // 🔓 endpoint agora é público – não exige mais user / auth
      const { collectionId } =
        request.params as ListLLMResponsesParams;

      const {
        testName,
        llmModel,
        promptType,
        page,
        pageSize,
      } = request.query as ListLLMResponsesQuery;

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

      const pageNum =
        Number(page) && Number(page) > 0 ? Number(page) : 1;

      const pageSizeNum =
        Number(pageSize) && Number(pageSize) > 0
          ? Math.min(Number(pageSize), 200)
          : 20;

      const service = new ListLLMResponsesService();

      const allResults = await service.execute({
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
            prompt: (first as any).prompt ?? null,
          }
        : {
            testName,
            llmModel: llmModel ?? null,
            promptType: promptType ?? null,
            prompt: null,
          };

      // ✅ agora mandamos os docs completos da página selecionada
      // (acq_id, sec, prompt, response, tokens, latency, createdAt, etc)
      const items = allResults.slice(start, end);

      return reply.send({
        items,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        ...meta,
      });
    } catch (err: any) {
      console.error("[ListLLMResponsesController] Error:", err);
      return reply
        .status(500)
        .send({ error: "INTERNAL_SERVER_ERROR" });
    }
  }
}
