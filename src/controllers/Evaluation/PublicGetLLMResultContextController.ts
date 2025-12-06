// src/controllers/PublicGetLLMResultContextController.ts
import { FastifyReply, FastifyRequest } from "fastify";
import { publicGetLLMResultContextService } from "../../services/Evaluation/publicGetLLMResultContextService";

type PublicGetLLMResultContextQuery = {
  collectionId: string;
  testName: string;
  llmModel: string;
  promptType: string;
  acq_id: string;
  sec: string; // vem como string na query
};

export class PublicGetLLMResultContextController {
  async handle(
    request: FastifyRequest<{ Querystring: PublicGetLLMResultContextQuery }>,
    reply: FastifyReply
  ) {
    const {
      collectionId,
      testName,
      llmModel,
      promptType,
      acq_id,
      sec,
    } = request.query;

    if (
      !collectionId ||
      !testName ||
      !llmModel ||
      !promptType ||
      !acq_id ||
      sec === undefined
    ) {
      return reply.status(400).send({
        error: "MISSING_PARAMS",
        details:
          "Required query params: collectionId, testName, llmModel, promptType, acq_id, sec.",
      });
    }

    const parsedSec = Number(sec);
    if (Number.isNaN(parsedSec)) {
      return reply.status(400).send({
        error: "INVALID_SEC",
        details: "Parameter 'sec' must be a valid number.",
      });
    }

    const result = await publicGetLLMResultContextService({
      collectionId,
      testName,
      llmModel,
      promptType,
      acq_id,
      sec: parsedSec,
    });

    if ((result as any).error === "LLM_RESULT_NOT_FOUND") {
      return reply.status(404).send(result);
    }

    return reply.send(result);
  }
}
