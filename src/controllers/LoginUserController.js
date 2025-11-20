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
exports.LoginUserController = void 0;
const LoginUserService_1 = require("../services/LoginUserService");
class LoginUserController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password } = request.body;
                const loginUserService = new LoginUserService_1.LoginUserService();
                const result = yield loginUserService.execute({ email, password });
                // Se quiser usar só token no body:
                return reply.status(200).send(result);
                /*
                // Se quiser usar cookie httpOnly em vez de devolver só no body:
                reply
                  .setCookie("auth_token", result.token, {
                    httpOnly: true,
                    path: "/",
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    maxAge: 7 * 24 * 60 * 60, // 7 dias
                  })
                  .status(200)
                  .send({ user: result.user });
                */
            }
            catch (err) {
                console.error("[LoginUserController] Error:", err);
                if (err.message === "EMAIL_OR_PASSWORD_MISSING") {
                    return reply.status(400).send({ error: "E-mail e senha são obrigatórios." });
                }
                if (err.message === "INVALID_CREDENTIALS") {
                    return reply.status(401).send({ error: "Credenciais inválidas." });
                }
                return reply.status(500).send({ error: "Erro interno ao fazer login." });
            }
        });
    }
}
exports.LoginUserController = LoginUserController;
