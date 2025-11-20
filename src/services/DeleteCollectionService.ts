import prismaClient from "../prisma";

class DeleteCollectionService {
  async execute(userId: string, collectionId: string) {
    const existing = await prismaClient.collection.findFirst({
      where: {
        id: collectionId,
        userId,
      },
    });

    if (!existing) {
      throw new Error("COLLECTION_NOT_FOUND_OR_FORBIDDEN");
    }

    // Remove itens primeiro (Mongo/Prisma não faz cascade automático)
    await prismaClient.collectionItem.deleteMany({
      where: { collectionId },
    });

    await prismaClient.collection.delete({
      where: { id: collectionId },
    });

    return { success: true };
  }
}

export { DeleteCollectionService };
