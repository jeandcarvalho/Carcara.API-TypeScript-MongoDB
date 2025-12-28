// src/controllers/ListLLMTestsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ListLLMTestsService } from "../../services/LLMResult/ListLLMTestsService";

type ListLLMTestsParams = {
  collectionId: string;
};

export class ListLLMTestsController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { collectionId } = request.params as ListLLMTestsParams;

      if (!collectionId) {
        return reply.status(400).send({ error: "COLLECTION_ID_REQUIRED" });
      }

      const service = new ListLLMTestsService();
      const tests = await service.execute({ collectionId });

      return reply.send({ data: tests });
    } catch (err: any) {
      console.error("[ListLLMTestsController] Error:", err);
      return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
    }
  }
}
