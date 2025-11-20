// src/controllers/LoginUserController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { LoginUserService } from "../services/LoginUserService";

class LoginUserController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email, password } = request.body as {
        email: string;
        password: string;
      };

      const loginUserService = new LoginUserService();
      const result = await loginUserService.execute({ email, password });

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
    } catch (err: any) {
      console.error("[LoginUserController] Error:", err);

      if (err.message === "EMAIL_OR_PASSWORD_MISSING") {
        return reply.status(400).send({ error: "E-mail e senha são obrigatórios." });
      }

      if (err.message === "INVALID_CREDENTIALS") {
        return reply.status(401).send({ error: "Credenciais inválidas." });
      }

      return reply.status(500).send({ error: "Erro interno ao fazer login." });
    }
  }
}

export { LoginUserController };
