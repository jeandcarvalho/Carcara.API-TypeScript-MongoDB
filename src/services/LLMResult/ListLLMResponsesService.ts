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
    if (!collectionId) throw new Error("COLLECTION_ID_REQUIRED");
    if (!testName) throw new Error("TEST_NAME_REQUIRED");

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
        acq_id: true,
        centerSec: true,
        llmModel: true,
        testName: true,
        promptType: true,
        // se quiser ter o prompt bruto disponível:
        // prompt: true,
      },
      orderBy: [
        { acq_id: "asc" },
        { centerSec: "asc" },
      ],
    });

    console.log(
      "[ListLLMResponsesService] found docs:",
      results.length
    );

    // mapeia para um formato intermediário (com meta em cada doc)
    return results.map((r) => ({
      acq_id: r.acq_id,
      sec: r.centerSec,
      llmModel: r.llmModel,
      testName: r.testName,
      promptType: r.promptType,
      // prompt: r.prompt,
    }));
  }
}
