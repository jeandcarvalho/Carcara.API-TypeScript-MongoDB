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
exports.MeController = void 0;
const MeService_1 = require("../services/MeService");
class MeController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userInfo = request.user;
                if (!userInfo || !userInfo.id) {
                    return reply.status(401).send({ error: "Usuário não autenticado." });
                }
                const meService = new MeService_1.MeService();
                const user = yield meService.execute(userInfo.id);
                return reply.status(200).send(user);
            }
            catch (err) {
                console.error("[MeController] Error:", err);
                if (err.message === "USER_NOT_FOUND") {
                    return reply.status(404).send({ error: "Usuário não encontrado." });
                }
                return reply.status(500).send({ error: "Erro interno ao buscar usuário." });
            }
        });
    }
}
exports.MeController = MeController;
