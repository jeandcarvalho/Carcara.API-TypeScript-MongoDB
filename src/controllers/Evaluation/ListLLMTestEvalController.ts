// src/controllers/ListLLMTestEvalController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ListLLMTestEvalService } from "../../services/Evaluation/ListLLMTestEvalService";
import prismaClient from "../../prisma";

type AuthUser = {
  id: string;
};

class ListLLMTestEvalController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = (request as any).user as AuthUser | undefined;

      if (!authUser || !authUser.id) {
        return reply.status(401).send({ error: "Unauthorized." });
      }

      // pega email/name a partir do id do token
      const dbUser = await prismaClient.user.findUnique({
        where: { id: authUser.id },
      });

      if (!dbUser || !dbUser.email) {
        return reply
          .status(400)
          .send({ error: "User email and name are required." });
      }

      const userEmail = dbUser.email;
      const userNameFinal = dbUser.name || dbUser.email;

      const query = request.query as any;

      const { collectionId, testName, llmModel, promptType } = query;

      if (!collectionId || !testName || !llmModel || !promptType) {
        return reply.status(400).send({
          error:
            "collectionId, testName, llmModel and promptType are required in query.",
        });
      }

      const service = new ListLLMTestEvalService();

      const result = await service.execute({
        collectionId: String(collectionId),
        userEmail: String(userEmail),
        userName: String(userNameFinal),
        testName: String(testName),
        llmModel: String(llmModel),
        promptType: String(promptType),
      });

      return reply.send(result);
    } catch (err) {
      console.error("[ListLLMTestEvalController] Error:", err);
      return reply
        .status(500)
        .send({ error: "Error listing LLM test evals." });
    }
  }
}

export { ListLLMTestEvalController };
