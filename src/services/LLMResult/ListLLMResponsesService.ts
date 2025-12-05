// src/services/LLMResult/ListLLMResponsesService.ts
import prismaClient from "../../prisma";

type ListLLMResponsesParams = {
  collectionId: string;
  testName: string;
  llmModel?: string;
  promptType?: string;
};

export class ListLLMResponsesService {
  async execute({
    collectionId,
    testName,
    llmModel,
    promptType,
  }: ListLLMResponsesParams) {
    if (!collectionId) {
      throw new Error("COLLECTION_ID_REQUIRED");
    }
    if (!testName) {
      throw new Error("TEST_NAME_REQUIRED");
    }

    const where: any = {
      collectionId,
      testName,
    };

    if (llmModel) where.llmModel = llmModel;
    if (promptType) where.promptType = promptType;

    console.log("[ListLLMResponsesService] where:", where);

    const results = await prismaClient.lLMResult.findMany({
      where,
      select: {
        id: true,
        acq_id: true,
        sec: true,
        llmModel: true,
        testName: true,
        promptType: true,
        prompt: true,
        response: true,
        totalTokens: true,
        latencyMs: true,   // 👈 aqui agora é latencyMs
        createdAt: true,
      },
      orderBy: [
        { acq_id: "asc" },
        { sec: "asc" },
      ],
    });

    console.log(
      "[ListLLMResponsesService] found docs:",
      results.length
    );

    // Se o schema tem latencyMs mesmo, não precisa converter nada,
    // só repassar pro front.
    return results.map((r) => ({
      ...r,
      latencyMs: r.latencyMs ?? null,
    }));
  }
}
