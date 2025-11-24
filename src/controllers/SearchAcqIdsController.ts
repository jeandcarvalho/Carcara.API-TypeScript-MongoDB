// src/controllers/SearchAcqIdsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { SearchAcqIdsService } from "../services/SearchAcqIdsService";

class SearchAcqIdsController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    const service = new SearchAcqIdsService();
    const result = await service.execute(request.query as any);
    return reply.send(result);
  }
}

export { SearchAcqIdsController };
