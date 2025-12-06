import prismaClient from "../../prisma";

type UpsertLLMTestEvalInput = {
  collectionId: string;

  userEmail: string;
  userName: string;

  acq_id: string;
  sec: number;

  testName: string;
  llmModel: string;
  promptType: string;

  test1: number;
  test2: number;
  test3: number;
  test4: number;
  test5: number;
};

class UpsertLLMTestEvalService {
  async execute(input: UpsertLLMTestEvalInput) {
    const {
      collectionId,
      userEmail,
      userName,
      acq_id,
      sec,
      testName,
      llmModel,
      promptType,
      test1,
      test2,
      test3,
      test4,
      test5,
    } = input;

    // 1) tenta achar um doc com o mesmo "combo"
    const existing = await prismaClient.lLMTestEval.findFirst({
      where: {
        collectionId,
        userEmail,
        acq_id,
        sec,
        testName,
        llmModel,
        promptType,
      },
    });

    if (existing) {
      // 2) se existir, atualiza as notas
      const updated = await prismaClient.lLMTestEval.update({
        where: {
          id: existing.id,
        },
        data: {
          userName, // pode atualizar o nome também
          test1,
          test2,
          test3,
          test4,
          test5,
        },
      });

      return updated;
    }

    // 3) senão, cria um novo
    const created = await prismaClient.lLMTestEval.create({
      data: {
        collectionId,
        userEmail,
        userName,
        acq_id,
        sec,
        testName,
        llmModel,
        promptType,
        test1,
        test2,
        test3,
        test4,
        test5,
      },
    });

    return created;
  }
}

export { UpsertLLMTestEvalService };
