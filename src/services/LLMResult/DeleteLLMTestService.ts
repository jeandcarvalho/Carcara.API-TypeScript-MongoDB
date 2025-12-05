import prismaClient from "../../prisma";

class DeleteLLMTestService {
  async execute(
    userId: string,
    collectionId: string,
    params: { testName: string; llmModel?: string; promptType?: string }
  ) {
    const { testName, llmModel, promptType } = params;

    const collection = await prismaClient.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!collection) {
      throw new Error("COLLECTION_NOT_FOUND_OR_FORBIDDEN");
    }

    const where: any = {
      collectionId,
      testName,
    };

    if (llmModel) where.llmModel = llmModel;
    if (promptType) where.promptType = promptType;

    const result = await prismaClient.lLMResult.deleteMany({ where });

    return { deletedCount: result.count };
  }
}

export { DeleteLLMTestService };
