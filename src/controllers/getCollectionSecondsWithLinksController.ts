// src/controllers/GetCollectionSecondsWithLinksController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { getCollectionSecondsWithLinksService } from "../services/getCollectionSecondsWithLinksService";

type GetCollectionSecondsWithLinksParams = {
  collectionId: string;
};

export class GetCollectionSecondsWithLinksController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    const anyReq = request as any;

    // Tenta vários lugares comuns onde o middleware pode ter colocado o id
    const userId: string | undefined =
      anyReq.user_id ??
      anyReq.userId ??
      anyReq.user?.id ??
      anyReq.user?._id;

    const { collectionId } =
      request.params as GetCollectionSecondsWithLinksParams;

    if (!userId) {
      // LOG pra você ver nos logs da Render o que está chegando
      console.log("[seconds-with-links] missing userId", {
        authHeader: request.headers.authorization,
        user_id: anyReq.user_id,
        userId: anyReq.userId,
        user: anyReq.user,
      });

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
