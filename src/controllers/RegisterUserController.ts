// src/controllers/RegisterUserController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { RegisterUserService } from "../services/RegisterUserService";

class RegisterUserController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name, email, password } = request.body as {
        name?: string;
        email: string;
        password: string;
      };

      const registerUserService = new RegisterUserService();
      const user = await registerUserService.execute({ name, email, password });

      return reply.status(201).send(user);
    } catch (err: any) {
      console.error("[RegisterUserController] Error:", err);

      if (err.message === "EMAIL_OR_PASSWORD_MISSING") {
        return reply.status(400).send({ error: "E-mail e senha são obrigatórios." });
      }

      if (err.message === "USER_ALREADY_EXISTS") {
        return reply.status(409).send({ error: "Já existe um usuário com esse e-mail." });
      }

      return reply.status(500).send({ error: "Erro interno ao registrar usuário." });
    }
  }
}

export { RegisterUserController };
