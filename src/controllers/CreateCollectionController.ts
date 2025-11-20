import { FastifyRequest, FastifyReply } from "fastify";
import { CreateCollectionService } from "../services/CreateCollectionService";

type Body = {
  name: string;
  description?: string;
};

class CreateCollectionController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user as { id: string } | undefined;
      if (!user) {
        return reply.status(401).send({ error: "Unauthorized." });
      }

      const { name, description } = request.body as Body;

      const service = new CreateCollectionService();
      const col = await service.execute({
        userId: user.id,
        name,
        description,
      });

      return reply.status(201).send(col);
    } catch (err: any) {
      console.error("[CreateCollectionController] Error:", err);

      if (err.message === "NAME_REQUIRED") {
        return reply.status(400).send({ error: "Name is required." });
      }

      return reply
        .status(500)
        .send({ error: "Error creating collection." });
    }
  }
}

export { CreateCollectionController };
