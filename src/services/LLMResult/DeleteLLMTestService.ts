// src/services/LLMResult/DeleteLLMTestService.ts
import prismaClient from "../../prisma";

type DeleteLLMTestParams = {
  collectionId: string;
  testName: string;
  llmModel?: string;
  promptType?: string;
};

export class DeleteLLMTestService {
  async execute({
    collectionId,
    testName,
    llmModel,
    promptType,
  }: DeleteLLMTestParams) {
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

    console.log("[DeleteLLMTestService] delete where:", where);

    const result = await prismaClient.lLMResult.deleteMany({
      where,
    });

    console.log(
      "[DeleteLLMTestService] deleted docs count:",
      result.count
    );

    return {
      deletedCount: result.count,
    };
  }
}
