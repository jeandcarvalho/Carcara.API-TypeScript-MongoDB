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
        sec: true,
      },
      orderBy: [
        { acq_id: "asc" },
        { sec: "asc" }
      ],
    });

    console.log(
      "[ListLLMResponsesService] returning docs:",
      results.length
    );

    return results;
  }
}
