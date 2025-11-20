// src/controllers/MeController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { MeService } from "../services/MeService";

class MeController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userInfo = (request as any).user as { id: string; email: string } | undefined;

      if (!userInfo || !userInfo.id) {
        return reply.status(401).send({ error: "Usuário não autenticado." });
      }

      const meService = new MeService();
      const user = await meService.execute(userInfo.id);

      return reply.status(200).send(user);
    } catch (err: any) {
      console.error("[MeController] Error:", err);

      if (err.message === "USER_NOT_FOUND") {
        return reply.status(404).send({ error: "Usuário não encontrado." });
      }

      return reply.status(500).send({ error: "Erro interno ao buscar usuário." });
    }
  }
}

export { MeController };
