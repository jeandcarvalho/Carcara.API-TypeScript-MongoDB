import prismaClient from "../prisma";

class ListCollectionsService {
  async execute(userId: string) {
    const collections = await prismaClient.collection.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: { items: true },
        },
      },
    });

    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      createdAt: c.createdAt,
      itemsCount: c._count.items,
    }));
  }
}

export { ListCollectionsService };
