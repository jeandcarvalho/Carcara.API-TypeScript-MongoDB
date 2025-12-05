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
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user as { id: string } | undefined;
      const { collectionId } = request.params as ListLLMResponsesParams;
      const { testName, llmModel, promptType } =
        request.query as ListLLMResponsesQuery;

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
