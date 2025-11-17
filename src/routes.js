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
const ListFilesController_1 = require("./controllers/ListFilesController");
const HomeController_1 = require("./controllers/HomeController");
const ListCounterController_1 = require("./controllers/ListCounterController");
const SearchBigController_1 = require("./controllers/SearchBigController"); // ⬅️ novo
function routes(fastify, options) {
    return __awaiter(this, void 0, void 0, function* () {
        // rota de listagem de arquivos
        fastify.get("/videofiles", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new ListFilesController_1.ListFilesController().handle(request, reply);
        }));
        // contador principal (POST)
        fastify.post("/homecounter", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new HomeController_1.HomeController().handle(request, reply);
        }));
        // contador (GET)
        fastify.get("/counter", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new ListCounterController_1.ListCounterController().handle(request, reply);
        }));
        // 🔍 nova rota de busca CarCará usando big_1hz
        fastify.get("/api/search", (request, reply) => __awaiter(this, void 0, void 0, function* () {
            return new SearchBigController_1.SearchBigController().handle(request, reply);
        }));
    });
}
exports.routes = routes;
