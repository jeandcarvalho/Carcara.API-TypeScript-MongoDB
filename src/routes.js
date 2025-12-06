"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = void 0;
// Controllers de items da coleção (funções)
const get_collection_items_by_acq_1 = require("./controllers/collections/get-collection-items-by-acq");
const add_items_to_collection_1 = require("./controllers/collections/add-items-to-collection");
const remove_items_from_collection_1 = require("./controllers/collections/remove-items-from-collection");
const getCollectionSecondsWithLinksController_1 = require("./controllers/getCollectionSecondsWithLinksController");
// Controllers existentes
const ListFilesController_1 = require("./controllers/ListFilesController");
const HomeController_1 = require("./controllers/HomeController");
const ListCounterController_1 = require("./controllers/ListCounterController");
const SearchBigController_1 = require("./controllers/SearchBigController");
const SearchAcquisitionController_1 = require("./controllers/SearchAcquisitionController");
const SearchAcqIdsController_1 = require("./controllers/SearchAcqIdsController");
// Controllers de autenticação
const RegisterUserController_1 = require("./controllers/RegisterUserController");
const LoginUserController_1 = require("./controllers/LoginUserController");
const MeController_1 = require("./controllers/MeController");
// Middleware de autenticação
const ensureAuthenticated_1 = require("./middlewares/ensureAuthenticated");
// Controllers de coleções (já existentes)
const ListCollectionsController_1 = require("./controllers/ListCollectionsController");
const CreateCollectionController_1 = require("./controllers/CreateCollectionController");
const DeleteCollectionController_1 = require("./controllers/DeleteCollectionController");
// Controllers de LLMResult 
const ListLLMTestsController_1 = require("./controllers/LLMResult/ListLLMTestsController");
const ListLLMResponsesController_1 = require("./controllers/LLMResult/ListLLMResponsesController");
const DeleteLLMTestController_1 = require("./controllers/LLMResult/DeleteLLMTestController");
// Controllers de LLMEvaluation
const ListLLMTestEvalController_1 = require("./controllers/Evaluation/ListLLMTestEvalController");
const UpsertLLMTestEvalController_1 = require("./controllers/Evaluation/UpsertLLMTestEvalController");
function routes(fastify, options) {
    return __awaiter(this, void 0, void 0, function* () {
        /* ===============================
             AUTH - Registro/Login
        =============================== */
        fastify.post("/auth/register", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new RegisterUserController_1.RegisterUserController().handle(request, reply);
        }));
        fastify.post("/auth/login", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new LoginUserController_1.LoginUserController().handle(request, reply);
        }));
        fastify.get("/auth/me", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new MeController_1.MeController().handle(request, reply);
        }));
        /* ===============================
               ROTAS EXISTENTES
        =============================== */
        fastify.get("/videofiles", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new ListFilesController_1.ListFilesController().handle(request, reply);
        }));
        fastify.post("/homecounter", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new HomeController_1.HomeController().handle(request, reply);
        }));
        fastify.get("/counter", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new ListCounterController_1.ListCounterController().handle(request, reply);
        }));
        fastify.get("/api/search", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new SearchBigController_1.SearchBigController().handle(request, reply);
        }));
        fastify.get("/api/acquisition", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new SearchAcquisitionController_1.SearchAcquisitionController().handle(request, reply);
        }));
        fastify.get("/api/search-acq-ids", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new SearchAcqIdsController_1.SearchAcqIdsController().handle(request, reply);
        }));
        /* ===============================
               COLEÇÕES DO USUÁRIO
        =============================== */
        // Listar coleções do usuário
        fastify.get("/collections", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new ListCollectionsController_1.ListCollectionsController().handle(request, reply);
        }));
        // Criar nova coleção
        fastify.post("/collections", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new CreateCollectionController_1.CreateCollectionController().handle(request, reply);
        }));
        // Deletar coleção
        fastify.delete("/collections/:id", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new DeleteCollectionController_1.DeleteCollectionController().handle(request, reply);
        }));
        fastify.get("/collections/:collectionId/seconds-with-links", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new getCollectionSecondsWithLinksController_1.GetCollectionSecondsWithLinksController().handle(request, reply);
        }));
        /* ===============================
             ITEMS DA COLEÇÃO (acq_id + sec)
        =============================== */
        // Buscar secs de uma acq_id dentro de uma coleção
        fastify.get("/collections/:collectionId/items", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new get_collection_items_by_acq_1.GetCollectionItemsByAcqController().handle(request, reply);
        }));
        // Adicionar momentos na coleção
        fastify.post("/collections/:collectionId/items/add", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new add_items_to_collection_1.AddItemsToCollectionController().handle(request, reply);
        }));
        // Remover momentos da coleção
        fastify.post("/collections/:collectionId/items/remove", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new remove_items_from_collection_1.RemoveItemsFromCollectionController().handle(request, reply);
        }));
        /* ===============================
           ITEMS DA LLMRESULT (acq_id + sec)
      =============================== */
        // 1) Lista os testes agregados (por testName) de uma coleção
        fastify.get("/api/llm/tests/:collectionId", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new ListLLMTestsController_1.ListLLMTestsController().handle(request, reply);
        }));
        // 2) Lista os docs (acq_id + sec) de um teste específico
        fastify.get("/api/llm/test-docs/:collectionId", 
        // ✅ sem ensureAuthenticated aqui
        (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new ListLLMResponsesController_1.ListLLMResponsesController().handle(request, reply);
        }));
        // 3) Deleta todos os docs de um teste em uma coleção
        fastify.delete("/api/llm/tests/:collectionId", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new DeleteLLMTestController_1.DeleteLLMTestController().handle(request, reply);
        }));
        /* ===============================
               LLM TEST EVALUATION
           (Avaliações 0..5 por sec)
        =============================== */
        // 1) Cria ou atualiza avaliação (upsert)
        fastify.post("/api/llm/eval", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new UpsertLLMTestEvalController_1.UpsertLLMTestEvalController().handle(request, reply);
        }));
        // 2) Lista avaliações filtradas
        fastify.get("/api/llm/eval", { preHandler: [ensureAuthenticated_1.ensureAuthenticated] }, (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new ListLLMTestEvalController_1.ListLLMTestEvalController().handle(request, reply);
        }));
    });
}
exports.routes = routes;
