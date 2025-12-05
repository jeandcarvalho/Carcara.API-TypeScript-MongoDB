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
      const user = (request as any).user as { id: string } | undefined;
      if (!user) {
        return reply.status(401).send({ error: "UNAUTHORIZED" });
      }

      const { collectionId } = request.params as ListLLMResponsesParams;
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
      const meta = allResults[0]
        ? {
            testName: allResults[0].testName,
            llmModel: allResults[0].llmModel,
            promptType: allResults[0].promptType,
            // prompt: allResults[0].prompt,
          }
        : {
            testName,
            llmModel: llmModel ?? null,
            promptType: promptType ?? null,
            // prompt: null,
          };

      // items: só acq_id + sec (como você pediu)
      const items = allResults.slice(start, end).map((r) => ({
        acq_id: r.acq_id,
        sec: r.sec,
      }));

      return reply.send({
        items,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        ...meta, // testName, llmModel, promptType (+ prompt se quiser)
      });
    } catch (err: any) {
      console.error("[ListLLMResponsesController] Error:", err);
      return reply
        .status(500)
        .send({ error: "INTERNAL_SERVER_ERROR" });
    }
  }
}
