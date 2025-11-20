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
exports.RegisterUserController = void 0;
const RegisterUserService_1 = require("../services/RegisterUserService");
class RegisterUserController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { name, email, password } = request.body;
                const registerUserService = new RegisterUserService_1.RegisterUserService();
                const user = yield registerUserService.execute({ name, email, password });
                return reply.status(201).send(user);
            }
            catch (err) {
                console.error("[RegisterUserController] Error:", err);
                if (err.message === "EMAIL_OR_PASSWORD_MISSING") {
                    return reply.status(400).send({ error: "E-mail e senha são obrigatórios." });
                }
                if (err.message === "USER_ALREADY_EXISTS") {
                    return reply.status(409).send({ error: "Já existe um usuário com esse e-mail." });
                }
                return reply.status(500).send({ error: "Erro interno ao registrar usuário." });
            }
        });
    }
}
exports.RegisterUserController = RegisterUserController;
