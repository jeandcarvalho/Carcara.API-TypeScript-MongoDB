// src/routes.ts
import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { ListFilesController } from "./controllers/ListFilesController";
import { HomeController } from "./controllers/HomeController";
import { ListCounterController } from "./controllers/ListCounterController";
import { SearchBigController } from "./controllers/SearchBigController"; // ⬅️ novo

export async function routes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions,
) {
  // rota de listagem de arquivos
  fastify.get(
    "/videofiles",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new ListFilesController().handle(request, reply);
    },
  );

  // contador principal (POST)
  fastify.post(
    "/homecounter",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new HomeController().handle(request, reply);
    },
  );

  // contador (GET)
  fastify.get(
    "/counter",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new ListCounterController().handle(request, reply);
    },
  );

  // 🔍 nova rota de busca CarCará usando big_1hz
  fastify.get(
    "/api/search",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new SearchBigController().handle(request, reply);
    },
  );
}
