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
exports.SearchLinksController = void 0;
const SearchLinksService_1 = require("../services/SearchLinksService");
class SearchLinksController {
    handle(request, reply) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // request.raw.url traz "/api/search?..." mesmo atrás de proxies
            const rawUrl = ((_a = request.raw) === null || _a === void 0 ? void 0 : _a.url) || request.url;
            // cria instância da service e usa o método de instância executeFromURL
            const service = new SearchLinksService_1.SearchLinksService();
            const result = yield service.executeFromURL(rawUrl);
            reply.send(result);
        });
    }
}
exports.SearchLinksController = SearchLinksController;
