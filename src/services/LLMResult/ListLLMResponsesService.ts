import prismaClient from "../../prisma";

class ListLLMResponsesService {
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

    const results = await prismaClient.lLMResult.findMany({
      where,
      select: {
        id: true,
        acq_id: true,
        sec: true,
        llmModel: true,
        testName: true,
        promptType: true,
        createdAt: true,
      },
      orderBy: [{ acq_id: "asc" }, { sec: "asc" }],
    });

    return results;
  }
}

export { ListLLMResponsesService };
