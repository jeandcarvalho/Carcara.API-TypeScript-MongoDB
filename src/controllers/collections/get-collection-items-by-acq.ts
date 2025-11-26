// src/controllers/collections/GetCollectionItemsByAcqController.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  getCollectionSecsForAcqService,
  CollectionSecsResult,
} from "../../services/collections-service";

class GetCollectionItemsByAcqController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;

    if (!user || !user.id) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { collectionId } = request.params as { collectionId: string };
    const { acq_id } = request.query as { acq_id?: string };

    if (!acq_id) {
      return reply.code(400).send({ error: "Missing acq_id" });
    }

    const result: CollectionSecsResult | null =
      await getCollectionSecsForAcqService(user.id, collectionId, acq_id);

    if (!result) {
      return reply.code(404).send({ error: "Collection not found" });
    }

    return reply.send(result);
  }
}export{GetCollectionItemsByAcqController}
