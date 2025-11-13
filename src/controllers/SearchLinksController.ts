// controllers/SearchLinksController.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { SearchLinksService } from '../services/SearchLinksService';

export class SearchLinksController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    // request.raw.url traz "/api/search?..." mesmo atrás de proxies
    const rawUrl = request.raw?.url || request.url;

    // método estático da service
    const result = await SearchLinksService.executeFromURL(rawUrl);

    reply.send(result);
  }
}
