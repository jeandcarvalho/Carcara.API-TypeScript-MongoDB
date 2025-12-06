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
import { GetCollectionSecondsWithLinksController } from "./controllers/getCollectionSecondsWithLinksController";

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


// Controllers de LLMResult 
import { ListLLMTestsController } from "./controllers/LLMResult/ListLLMTestsController";
import { ListLLMResponsesController } from "./controllers/LLMResult/ListLLMResponsesController";
import { DeleteLLMTestController } from "./controllers/LLMResult/DeleteLLMTestController";

// Controllers de LLMEvaluation
import { ListLLMTestEvalController } from "./controllers/Evaluation/ListLLMTestEvalController";
import { UpsertLLMTestEvalController } from "./controllers/Evaluation/UpsertLLMTestEvalController";
import { PublicGetLLMResultContextController } from "./controllers/Evaluation/PublicGetLLMResultContextController";

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

fastify.get(
  "/collections/:collectionId/seconds-with-links",
  { preHandler: [ensureAuthenticated] },
  async (request: FastifyRequest, reply: FastifyReply) => {
    return new GetCollectionSecondsWithLinksController().handle(request, reply);
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

  


    /* ===============================
       ITEMS DA LLMRESULT (acq_id + sec)
  =============================== */
// 1) Lista os testes agregados (por testName) de uma coleção
fastify.get(
  "/api/llm/tests/:collectionId",
  { preHandler: [ensureAuthenticated] },
  async (request: FastifyRequest, reply: FastifyReply) => {
    return new ListLLMTestsController().handle(request, reply);
  }
);

// 2) Lista os docs (acq_id + sec) de um teste específico
fastify.get(
  "/api/llm/test-docs/:collectionId",
  // ✅ sem ensureAuthenticated aqui
  async (request, reply) => {
    return new ListLLMResponsesController().handle(request, reply);
  }
);


// 3) Deleta todos os docs de um teste em uma coleção
fastify.delete(
  "/api/llm/tests/:collectionId",
  { preHandler: [ensureAuthenticated] },
  async (request: FastifyRequest, reply: FastifyReply) => {
    return new DeleteLLMTestController().handle(request, reply);
  }
);



/* ===============================
       LLM TEST EVALUATION
   (Avaliações 0..5 por sec)
=============================== */

// 1) Cria ou atualiza avaliação (upsert)
fastify.post(
  "/api/llm/eval",
  { preHandler: [ensureAuthenticated] },
  async (request: FastifyRequest, reply: FastifyReply) => {
    return new UpsertLLMTestEvalController().handle(request, reply);
  }
);

// 2) Lista avaliações filtradas
fastify.get(
  "/api/llm/eval",
  { preHandler: [ensureAuthenticated] },
  async (request: FastifyRequest, reply: FastifyReply) => {
    return new ListLLMTestEvalController().handle(request, reply);
  }
);


fastify.get(
    "/public/llmresult/context",
    new PublicGetLLMResultContextController().handle
  );





}
