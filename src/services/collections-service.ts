// src/services/collections/CollectionsService.ts
import prismaClient from "../prisma";

/** Resumo de coleção para listagem */
export type CollectionSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  itemsCount: number;
};

/** Item (momento) de coleção, baseado em acq_id + sec */
export type CollectionItemInput = {
  acq_id: string;
  sec: number;
};

export type CollectionSecsResult = {
  collectionId: string;
  acq_id: string;
  secs: number[];
};

export type AddItemsResult = {
  inserted: number;
};

export type RemoveItemsResult = {
  deleted: number;
};

// ---------------------------
// 1) Listar coleções do user
// ---------------------------
export async function getUserCollectionsService(
  userId: string
): Promise<CollectionSummary[]> {
  type PrismaCollectionWithCount = {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    _count: { items: number };
  };

  const collections = (await prismaClient.collection.findMany({
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
  })) as PrismaCollectionWithCount[];

  return collections.map((c: PrismaCollectionWithCount) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    createdAt: c.createdAt,
    itemsCount: c._count.items,
  }));
}

// --------------------------------------------------------
// 2) Buscar secs de uma acq_id específica dentro da coleção
// --------------------------------------------------------
export async function getCollectionSecsForAcqService(
  userId: string,
  collectionId: string,
  acq_id: string
): Promise<CollectionSecsResult | null> {
  const collection = await prismaClient.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true },
  });

  if (!collection) {
    return null;
  }

  type ItemRow = { sec: number };

  const items = (await prismaClient.collectionItem.findMany({
    where: { collectionId, acq_id },
    select: { sec: true },
    orderBy: { sec: "asc" },
  })) as ItemRow[];

  return {
    collectionId,
    acq_id,
    secs: items.map((i: ItemRow) => i.sec),
  };
}

// ----------------------------------------------------
// 3) Adicionar momentos (acq_id + sec) à coleção
// ----------------------------------------------------
export async function addItemsToCollectionService(
  userId: string,
  collectionId: string,
  items: CollectionItemInput[]
): Promise<AddItemsResult | null> {
  const collection = await prismaClient.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true },
  });

  if (!collection) {
    return null;
  }

  // remove duplicados dentro do payload
  const unique = new Map<string, CollectionItemInput>();
  for (const item of items) {
    if (!item.acq_id || typeof item.sec !== "number") continue;
    const key = `${item.acq_id}:${item.sec}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  const dataToInsert = Array.from(unique.values()).map(
    (item: CollectionItemInput) => ({
      collectionId,
      acq_id: item.acq_id,
      sec: item.sec,
    })
  );

  if (dataToInsert.length === 0) {
    return { inserted: 0 };
  }

  const result = await prismaClient.collectionItem.createMany({
    data: dataToInsert,
    // Mongo não suporta skipDuplicates
  });

  return { inserted: result.count };
}

// ----------------------------------------------------
// 4) Remover momentos (acq_id + sec) da coleção
// ----------------------------------------------------
export async function removeItemsFromCollectionService(
  userId: string,
  collectionId: string,
  items: CollectionItemInput[]
): Promise<RemoveItemsResult | null> {
  const collection = await prismaClient.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true },
  });

  if (!collection) {
    return null;
  }

  const orConditions = items
    .filter((item) => item.acq_id && typeof item.sec === "number")
    .map((item) => ({
      acq_id: item.acq_id,
      sec: item.sec,
    }));

  if (orConditions.length === 0) {
    return { deleted: 0 };
  }

  const result = await prismaClient.collectionItem.deleteMany({
    where: {
      collectionId,
      OR: orConditions,
    },
  });

  return { deleted: result.count };
}
