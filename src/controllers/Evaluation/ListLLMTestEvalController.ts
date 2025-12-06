import { FastifyRequest, FastifyReply } from "fastify";
import { ListLLMTestEvalService } from "../../services/Evaluation/ListLLMTestEvalService";

type AuthUser = {
  id: string;
  email?: string;
  name?: string;
};

class ListLLMTestEvalController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user as AuthUser | undefined;

      if (!user) {
        return reply.status(401).send({ error: "Unauthorized." });
      }

      const query = request.query as any;

      const {
        collectionId,
        email,
        userName,
        testName,
        llmModel,
        promptType,
      } = query;

      if (
        !collectionId ||
        !testName ||
        !llmModel ||
        !promptType
      ) {
        return reply.status(400).send({
          error:
            "collectionId, testName, llmModel and promptType are required in query.",
        });
      }

      // mesma lógica: se token tiver email/nome, prioriza ele; senão, usa query
      const userEmail = user.email ?? email;
      const userNameFinal = user.name ?? userName;

      if (!userEmail || !userNameFinal) {
        return reply
          .status(400)
          .send({ error: "User email and name are required." });
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
