import { FastifyRequest, FastifyReply } from "fastify";
import { ListLLMTestsService } from "../../services/LLMResult/ListLLMTestsService";

class ListLLMTestsController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user as { id: string } | undefined;
      if (!user) {
        return reply.status(401).send({ error: "Unauthorized." });
      }

      const { collectionId } = request.params as { collectionId: string };

      const service = new ListLLMTestsService();
      const data = await service.execute(user.id, collectionId);

      return reply.status(200).send({ data });
    } catch (err: any) {
      console.error("[ListLLMTestsController] Error:", err);

      if (err.message === "COLLECTION_NOT_FOUND_OR_FORBIDDEN") {
        return reply
          .status(404)
          .send({ error: "Collection not found or not allowed." });
      }

      return reply
        .status(500)
        .send({ error: "Error listing LLM tests." });
    }
  }
}

export { ListLLMTestsController };
