// src/routes.ts
import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";

// Controllers de items da coleção (funções)
import { GetCollectionItemsByAcqController } from "./controllers/collections/get-collection-items-by-acq";
import { AddItemsToCollectionController } from "./controllers/collections/add-items-to-collection";
import { RemoveItemsFromCollectionController } from "./controllers/collections/remove-items-from-collection";

// Controllers existentes
import { ListFilesController } from "./controllers/ListFilesController";
import { HomeController } from "./controllers/HomeController";
import { ListCounterController } from "./controllers/ListCounterController";
import { SearchBigController } from "./controllers/SearchBigController";
import { SearchAcquisitionController } from "./controllers/SearchAcquisitionController";
import { SearchAcqIdsController } from "./controllers/SearchAcqIdsController";

// Controllers de autenticação
import { RegisterUserController } from "./controllers/RegisterUserController";
import { LoginUserController } from "./controllers/LoginUserController";
import { MeController } from "./controllers/MeController";

// Middleware de autenticação
import { ensureAuthenticated } from "./middlewares/ensureAuthenticated";

// Controllers de coleções (já existentes)
import { ListCollectionsController } from "./controllers/ListCollectionsController";
import { CreateCollectionController } from "./controllers/CreateCollectionController";
import { DeleteCollectionController } from "./controllers/DeleteCollectionController";

export async function routes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  /* ===============================
       AUTH - Registro/Login
  =============================== */

  fastify.post(
    "/auth/register",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new RegisterUserController().handle(request, reply);
    }
  );

  fastify.post(
    "/auth/login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new LoginUserController().handle(request, reply);
    }
  );

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

  fastify.get(
    "/videofiles",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new ListFilesController().handle(request, reply);
    }
  );

  fastify.post(
    "/homecounter",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new HomeController().handle(request, reply);
    }
  );

  fastify.get(
    "/counter",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new ListCounterController().handle(request, reply);
    }
  );

  fastify.get(
    "/api/search",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new SearchBigController().handle(request, reply);
    }
  );

  fastify.get(
    "/api/acquisition",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new SearchAcquisitionController().handle(request, reply);
    }
  );

  fastify.get(
    "/api/search-acq-ids",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new SearchAcqIdsController().handle(request, reply);
    }
  );

  /* ===============================
         COLEÇÕES DO USUÁRIO
  =============================== */

  // Listar coleções do usuário
  fastify.get(
    "/collections",
    { preHandler: [ensureAuthenticated] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new ListCollectionsController().handle(request, reply);
    }
  );

  // Criar nova coleção
  fastify.post(
    "/collections",
    { preHandler: [ensureAuthenticated] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new CreateCollectionController().handle(request, reply);
    }
  );

  // Deletar coleção
  fastify.delete(
    "/collections/:id",
    { preHandler: [ensureAuthenticated] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new DeleteCollectionController().handle(request, reply);
    }
  );

  /* ===============================
       ITEMS DA COLEÇÃO (acq_id + sec)
  =============================== */

  // Buscar secs de uma acq_id dentro de uma coleção
  fastify.get(
    "/collections/:collectionId/items",
    { preHandler: [ensureAuthenticated] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new GetCollectionItemsByAcqController().handle(request, reply);
    }
  );

  // Adicionar momentos na coleção
  fastify.post(
    "/collections/:collectionId/items/add",
    { preHandler: [ensureAuthenticated] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new AddItemsToCollectionController().handle(request, reply);
    }
  );

  // Remover momentos da coleção
  fastify.post(
    "/collections/:collectionId/items/remove",
    { preHandler: [ensureAuthenticated] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return new RemoveItemsFromCollectionController().handle(request, reply);
    }
  );
}
