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
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user as { id: string } | undefined;
      const { collectionId } = request.params as DeleteLLMTestParams;
      const { testName, llmModel, promptType } =
        request.query as DeleteLLMTestQuery;

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
