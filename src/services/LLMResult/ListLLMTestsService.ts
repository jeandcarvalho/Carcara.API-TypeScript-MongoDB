// src/services/LLMResult/ListLLMTestsService.ts
import prismaClient from "../../prisma";

type ListLLMTestsParams = {
  collectionId: string;
};

export class ListLLMTestsService {
  async execute({ collectionId }: ListLLMTestsParams) {
    if (!collectionId) {
      throw new Error("COLLECTION_ID_REQUIRED");
    }

    const grouped = await prismaClient.lLMResult.groupBy({
      by: ["testName", "llmModel", "promptType"],
      where: {
        collectionId,
      },
      _count: { _all: true },
      _min: { createdAt: true },
    });

    console.log(
      "[ListLLMTestsService] groupBy result length:",
      grouped.length
    );
    console.log("[ListLLMTestsService] sample:", grouped[0]);

    return grouped.map((g) => ({
      testName: g.testName,
      llmModel: g.llmModel,
      promptType: g.promptType,
      docsCount: g._count._all,      // <- nome que o front espera
      firstCreatedAt: g._min.createdAt,
    }));
  }
}
