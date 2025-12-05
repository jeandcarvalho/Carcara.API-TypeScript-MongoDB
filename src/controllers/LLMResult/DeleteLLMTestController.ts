// src/controllers/DeleteLLMTestController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { DeleteLLMTestService } from "../../services/LLMResult/DeleteLLMTestService";

type DeleteLLMTestParams = {
  collectionId: string;
};

type DeleteLLMTestQuery = {
  testName?: string;
  llmModel?: string;
  promptType?: string;
};

export class DeleteLLMTestController {
  async handle(
    request: FastifyRequest<{
      Params: DeleteLLMTestParams;
      Querystring: DeleteLLMTestQuery;
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

      const service = new DeleteLLMTestService();
      const result = await service.execute({
        collectionId,
        testName,
        llmModel,
        promptType,
      });

      return reply.send({ success: true, ...result });
    } catch (err: any) {
      console.error("[DeleteLLMTestController] Error:", err);
      return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
    }
  }
}
