import prismaClient from "../../prisma";

type ListLLMTestEvalInput = {
  collectionId: string;
  userEmail: string;
  userName: string;
  testName: string;
  llmModel: string;
  promptType: string;
};

class ListLLMTestEvalService {
  async execute(input: ListLLMTestEvalInput) {
    const {
      collectionId,
      userEmail,
      userName,
      testName,
      llmModel,
      promptType,
    } = input;

    const items = await prismaClient.lLMTestEval.findMany({
      where: {
        collectionId,
        userEmail,
        userName,
        testName,
        llmModel,
        promptType,
      },
      orderBy: {
        sec: "asc",
      },
    });

    return items;
  }
}

export { ListLLMTestEvalService };
