import { FastifyRequest, FastifyReply } from "fastify";
import { ListLLMResponsesService } from "../../services/LLMResult/ListLLMResponsesService";

class ListLLMResponsesController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user as { id: string } | undefined;
      if (!user) {
        return reply.status(401).send({ error: "Unauthorized." });
      }

      const { collectionId } = request.params as { collectionId: string };
      const { testName, llmModel, promptType } = request.query as {
        testName?: string;
        llmModel?: string;
        promptType?: string;
      };

      if (!testName) {
        return reply
          .status(400)
          .send({ error: "testName is required." });
      }

      const service = new ListLLMResponsesService();
      const data = await service.execute(user.id, collectionId, {
        testName,
        llmModel,
        promptType,
      });

      return reply.status(200).send({ data });
    } catch (err: any) {
      console.error("[ListLLMResponsesController] Error:", err);

      if (err.message === "COLLECTION_NOT_FOUND_OR_FORBIDDEN") {
        return reply
          .status(404)
          .send({ error: "Collection not found or not allowed." });
      }

      return reply
        .status(500)
        .send({ error: "Error listing LLM responses." });
    }
  }
}

export { ListLLMResponsesController };
