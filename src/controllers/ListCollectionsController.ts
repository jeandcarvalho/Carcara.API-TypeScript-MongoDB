import { FastifyRequest, FastifyReply } from "fastify";
import { ListCollectionsService } from "../services/ListCollectionsService";

class ListCollectionsController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user as { id: string } | undefined;
      if (!user) {
        return reply.status(401).send({ error: "Unauthorized." });
      }

      const service = new ListCollectionsService();
      const collections = await service.execute(user.id);

      return reply.send(collections);
    } catch (err) {
      console.error("[ListCollectionsController] Error:", err);
      return reply
        .status(500)
        .send({ error: "Error listing collections." });
    }
  }
}

export { ListCollectionsController };
