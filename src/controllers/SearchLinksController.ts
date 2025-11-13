// controllers/SearchLinksController.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { SearchLinksService } from '../services/SearchLinksService';

export class SearchLinksController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    const service = new SearchLinksService();
    // request.raw.url traz "/api/search?..." mesmo atrás de proxies
    const rawUrl = request.raw?.url || request.url;
    const result = await service.executeFromURL(rawUrl);
    reply.send(result);
  }
}
