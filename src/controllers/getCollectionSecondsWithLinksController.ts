// src/controllers/GetCollectionSecondsWithLinksController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { getCollectionSecondsWithLinksService } from "../services/getCollectionSecondsWithLinksService";

type GetCollectionSecondsWithLinksParams = {
  collectionId: string;
};

export class GetCollectionSecondsWithLinksController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user_id as string;

    const { collectionId } = request.params as GetCollectionSecondsWithLinksParams;

    if (!userId) {
      return reply.status(401).send({ error: "UNAUTHORIZED" });
    }

    if (!collectionId) {
      return reply.status(400).send({ error: "COLLECTION_ID_REQUIRED" });
    }

    const result = await getCollectionSecondsWithLinksService(userId, collectionId);

    if (!result) {
      return reply
        .status(404)
        .send({ error: "COLLECTION_NOT_FOUND_OR_FORBIDDEN" });
    }

    return reply.send(result);
  }
}
