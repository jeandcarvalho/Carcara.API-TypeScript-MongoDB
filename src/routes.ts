// src/routes.ts
import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";

// Controllers existentes
import { ListFilesController } from "./controllers/ListFilesController";
import { HomeController } from "./controllers/HomeController";
import { ListCounterController } from "./controllers/ListCounterController";
import { SearchBigController } from "./controllers/SearchBigController";
import { SearchAcquisitionController } from "./controllers/SearchAcquisitionController";


// Controllers de autenticação
import { RegisterUserController } from "./controllers/RegisterUserController";
import { LoginUserController } from "./controllers/LoginUserController";
import { MeController } from "./controllers/MeController";

// Middleware de autenticação
import { ensureAuthenticated } from "./middlewares/ensureAuthenticated";
import { ListCollectionsController } from "./controllers/ListCollectionsController";
import { CreateCollectionController } from "./controllers/CreateCollectionController";
import { DeleteCollectionController } from "./controllers/DeleteCollectionController";


export async function routes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions,
) {
  /* ===============================
       AUTH - Registro/Login
  =============================== */

  // Registrar usuário
  fastify.post(
    "/auth/register",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new RegisterUserController().handle(request, reply);
    }
  );

  // Login de usuário
  fastify.post(
    "/auth/login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new LoginUserController().handle(request, reply);
    }
  );

  // Retorna informações do usuário logado
  fastify.get(
    "/auth/me",
    { preHandler: [ensureAuthenticated] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new MeController().handle(request, reply);
    }
  );

  /* ===============================
         ROTAS EXISTENTES
  =============================== */

  // rota de listagem de arquivos
  fastify.get(
    "/videofiles",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new ListFilesController().handle(request, reply);
    }
  );

  // contador principal (POST)
  fastify.post(
    "/homecounter",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new HomeController().handle(request, reply);
    }
  );

  // contador (GET)
  fastify.get(
    "/counter",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new ListCounterController().handle(request, reply);
    }
  );

  // 🔍 nova rota de busca CarCará usando big_1hz
  fastify.get(
    "/api/search",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new SearchBigController().handle(request, reply);
    }
  );

    // 🔍 Nova rota: segundos + links para UMA aquisição específica
  fastify.get(
    "/api/acquisition",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new SearchAcquisitionController().handle(request, reply);
    },
  );


    // === User Collections (protected) ===
  fastify.get(
    "/collections",
    { preHandler: [ensureAuthenticated] },
    async (request, reply) => {
      return new ListCollectionsController().handle(request, reply);
    }
  );

  fastify.post(
    "/collections",
    { preHandler: [ensureAuthenticated] },
    async (request, reply) => {
      return new CreateCollectionController().handle(request, reply);
    }
  );

  fastify.delete(
    "/collections/:id",
    { preHandler: [ensureAuthenticated] },
    async (request, reply) => {
      return new DeleteCollectionController().handle(request, reply);
    }
  );

}
