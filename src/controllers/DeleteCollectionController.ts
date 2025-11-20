import { FastifyRequest, FastifyReply } from "fastify";
import { DeleteCollectionService } from "../services/DeleteCollectionService";

class DeleteCollectionController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user as { id: string } | undefined;
      if (!user) {
        return reply.status(401).send({ error: "Unauthorized." });
      }

      const { id } = request.params as { id: string };

      const service = new DeleteCollectionService();
      await service.execute(user.id, id);

      return reply.status(204).send();
    } catch (err: any) {
      console.error("[DeleteCollectionController] Error:", err);

      if (err.message === "COLLECTION_NOT_FOUND_OR_FORBIDDEN") {
        return reply
          .status(404)
          .send({ error: "Collection not found or not allowed." });
      }

      return reply
        .status(500)
        .send({ error: "Error deleting collection." });
    }
  }
}

export { DeleteCollectionController };
