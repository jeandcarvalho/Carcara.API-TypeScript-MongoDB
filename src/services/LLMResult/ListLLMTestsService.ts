// src/services/ListLLMTestsService.ts
import prismaClient from "../../prisma"; // ajusta o path se for diferente

type ListLLMTestsParams = {
  collectionId: string;
};

export class ListLLMTestsService {
  async execute({ collectionId }: ListLLMTestsParams) {
    if (!collectionId) {
      throw new Error("COLLECTION_ID_REQUIRED");
    }

    // groupBy por combinação de teste
    const grouped = await prismaClient.lLMResult.groupBy({
      by: ["testName", "llmModel", "promptType"],
      where: {
        collectionId,
      },
      _count: { _all: true },
      _min: { createdAt: true },
    });

    // normaliza resposta pro front
    return grouped.map((g) => ({
      testName: g.testName,
      llmModel: g.llmModel,
      promptType: g.promptType,
      totalDocs: g._count._all,
      createdAt: g._min.createdAt,
    }));
  }
}
