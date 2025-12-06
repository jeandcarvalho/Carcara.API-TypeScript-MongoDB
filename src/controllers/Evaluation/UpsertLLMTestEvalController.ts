// src/controllers/UpsertLLMTestEvalController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { UpsertLLMTestEvalService } from "../../services/Evaluation/UpsertLLMTestEvalService";
import prismaClient from "../../prisma";

type AuthUser = {
  id: string;
};

class UpsertLLMTestEvalController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = (request as any).user as AuthUser | undefined;

      if (!authUser || !authUser.id) {
        return reply.status(401).send({ error: "Unauthorized." });
      }

      // Busca o usuário completo pra ter email e name
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

      const body = request.body as any;

      const {
        collectionId,
        acq_id,
        sec,
        testName,
        llmModel,
        promptType,
        test1,
        test2,
        test3,
        test4,
        test5,
      } = body;

      if (
        !collectionId ||
        !acq_id ||
        sec === undefined ||
        !testName ||
        !llmModel ||
        !promptType
      ) {
        return reply.status(400).send({ error: "Missing required fields." });
      }

      // converte / valida inteiros
      const secNum = Number(sec);
      const t1 = Number(test1);
      const t2 = Number(test2);
      const t3 = Number(test3);
      const t4 = Number(test4);
      const t5 = Number(test5);

      const allInts = [secNum, t1, t2, t3, t4, t5].every((v) =>
        Number.isInteger(v)
      );
      if (!allInts) {
        return reply
          .status(400)
          .send({ error: "sec and tests must be integers." });
      }

      const inRange = [t1, t2, t3, t4, t5].every((v) => v >= 0 && v <= 5);
      if (!inRange) {
        return reply
          .status(400)
          .send({ error: "Tests must be between 0 and 5." });
      }

      const service = new UpsertLLMTestEvalService();

      const result = await service.execute({
        collectionId: String(collectionId),
        userEmail: String(userEmail),
        userName: String(userNameFinal),
        acq_id: String(acq_id),
        sec: secNum,
        testName: String(testName),
        llmModel: String(llmModel),
        promptType: String(promptType),
        test1: t1,
        test2: t2,
        test3: t3,
        test4: t4,
        test5: t5,
      });

      return reply.send(result);
    } catch (err) {
      console.error("[UpsertLLMTestEvalController] Error:", err);
      return reply
        .status(500)
        .send({ error: "Error saving LLM test eval." });
    }
  }
}

export { UpsertLLMTestEvalController };
