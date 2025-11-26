// src/controllers/collections/AddItemsToCollectionController.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  addItemsToCollectionService,
  CollectionItemInput,
  AddItemsResult,
} from "../../services/collections-service";

class AddItemsToCollectionController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;

    if (!user || !user.id) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { collectionId } = request.params as { collectionId: string };
    const body = request.body as { items?: CollectionItemInput[] } | undefined;
    const items = body?.items ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      return reply
        .code(400)
        .send({ error: "Body must contain a non-empty 'items' array." });
    }

    const result: AddItemsResult | null = await addItemsToCollectionService(
      user.id,
      collectionId,
      items
    );

    if (!result) {
      return reply.code(404).send({ error: "Collection not found" });
    }

    return reply.send(result);
  }
} export{AddItemsToCollectionController}
