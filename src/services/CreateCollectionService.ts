import prismaClient from "../prisma";

type CreateCollectionRequest = {
  userId: string;
  name: string;
  description?: string;
};

class CreateCollectionService {
  async execute({ userId, name, description }: CreateCollectionRequest) {
    if (!name || !name.trim()) {
      throw new Error("NAME_REQUIRED");
    }

    const col = await prismaClient.collection.create({
      data: {
        userId,
        name: name.trim(),
        description: description?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
      },
    });

    return col;
  }
}

export { CreateCollectionService };
