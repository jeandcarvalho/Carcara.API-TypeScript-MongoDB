// src/controllers/SearchBigController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { SearchBigService } from "../services/SearchBigService";

class SearchBigController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    const service = new SearchBigService();
    const result = await service.execute(request.query as any);
    return reply.send(result);
  }
}

export { SearchBigController };
