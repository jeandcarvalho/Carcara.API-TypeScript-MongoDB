// src/controllers/ListLLMResponsesController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ListLLMResponsesService } from "../../services/LLMResult/ListLLMResponsesService";

type ListLLMResponsesParams = {
  collectionId: string;
};

type ListLLMResponsesQuery = {
  testName?: string;
  llmModel?: string;
  promptType?: string;
};

export class ListLLMResponsesController {
  async handle(
    request: FastifyRequest<{
      Params: ListLLMResponsesParams;
      Querystring: ListLLMResponsesQuery;
    }>,
    reply: FastifyReply
  ) {
    try {
      const userId = (request as any).user_id as string;
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

      const service = new ListLLMResponsesService();
      const data = await service.execute({
        collectionId,
        testName,
        llmModel,
        promptType,
      });

      return reply.send({ data });
    } catch (err: any) {
      console.error("[ListLLMResponsesController] Error:", err);
      return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
    }
  }
}
