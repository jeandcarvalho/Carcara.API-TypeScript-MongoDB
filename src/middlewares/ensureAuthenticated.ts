// src/middlewares/ensureAuthenticated.ts
import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

type JwtPayload = {
  sub: string;
  email: string;
};

export async function ensureAuthenticated(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({ error: "Token não informado." });
  }

  const [, token] = authHeader.split(" "); // "Bearer token"

  if (!token) {
    return reply.status(401).send({ error: "Token mal formatado." });
  }

  try {
    const secret = process.env.JWT_SECRET || "dev-secret-change-me";

    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Anexa info do usuário à request
    (request as any).user = {
      id: decoded.sub,
      email: decoded.email,
    };
  } catch (err) {
    console.error("[ensureAuthenticated] Erro ao validar token:", err);
    return reply.status(401).send({ error: "Token inválido ou expirado." });
  }
}
