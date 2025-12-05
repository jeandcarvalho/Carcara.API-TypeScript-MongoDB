import prismaClient from "../../prisma";

class ListLLMTestsService {
  async execute(userId: string, collectionId: string) {
    // garante que a coleção é do usuário
    const collection = await prismaClient.collection.findFirst({
      where: {
        id: collectionId,
        userId,
      },
    });

    if (!collection) {
      throw new Error("COLLECTION_NOT_FOUND_OR_FORBIDDEN");
    }

    const grouped = await prismaClient.lLMResult.groupBy({
      by: ["testName", "llmModel", "promptType"],
      where: {
        collectionId,
      },
      _count: { _all: true },
      _min: { createdAt: true },
    });

    return grouped.map((g) => ({
      testName: g.testName,
      llmModel: g.llmModel,
      promptType: g.promptType,
      totalDocs: g._count._all,
      createdAt: g._min.createdAt,
    }));
  }
}

export { ListLLMTestsService };
