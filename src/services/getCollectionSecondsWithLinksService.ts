// src/services/GetCollectionSecondsWithLinksService.ts

import prismaClient from "../prisma";

// Extensões consideradas imagens — precisam bater com acq_id + sec
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

export type CollectionImageLink = {
  sec: number;
  ext: string;
  link: string;
};

export type CollectionFileLink = {
  ext: string;
  link: string;
};

export type CollectionSecondsWithLinksItem = {
  acq_id: string;
  secs: number[];
  images: CollectionImageLink[];
  files: CollectionFileLink[];
};

export type CollectionSecondsWithLinksResult = {
  collectionId: string;
  name: string;
  description: string | null;
  items: CollectionSecondsWithLinksItem[];
};

export async function getCollectionSecondsWithLinksService(
  userId: string,
  collectionId: string
): Promise<CollectionSecondsWithLinksResult | null> {
  // 1. Verificar se a coleção existe e pertence ao usuário
  const collection = await prismaClient.collection.findFirst({
    where: { id: collectionId, userId },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (!collection) {
    return null;
  }

  // 2. Buscar todos os items (acq_id + sec) da coleção
  const rawItems = await prismaClient.collectionItem.findMany({
    where: { collectionId },
    select: {
      acq_id: true,
      sec: true,
    },
  });

  if (rawItems.length === 0) {
    return {
      collectionId: collection.id,
      name: collection.name,
      description: collection.description,
      items: [],
    };
  }

  // 3. Agrupar segundos por acq_id
  const secsByAcq = new Map<string, Set<number>>();

  for (const item of rawItems) {
    const acqId = item.acq_id;
    const sec = item.sec;

    if (!secsByAcq.has(acqId)) {
      secsByAcq.set(acqId, new Set());
    }

    secsByAcq.get(acqId)!.add(sec);
  }

  const acqIds = Array.from(secsByAcq.keys());

  // 4. Buscar todos os links no Mongo (coleção "links")
  const linksDocs = await prismaClient.links.findMany({
    where: {
      acq_id: { in: acqIds },
    },
    select: {
      acq_id: true,
      sec: true,
      ext: true,
      link: true,
    },
  });

  // 5. Organizar links em:
  //    imagesByAcq: imagens (precisam bater acq_id + sec)
  //    filesByAcq: outros formatos (avi, csv, mf4, blf...) apenas 1 por ext
  const imagesByAcq = new Map<string, CollectionImageLink[]>();
  const filesByAcq = new Map<string, CollectionFileLink[]>();

  for (const doc of linksDocs) {
    const acqId = doc.acq_id;
    const ext = (doc.ext || "").toLowerCase();
    const sec = doc.sec ?? null;

    const secsSet = secsByAcq.get(acqId);
    if (!secsSet) continue;

    if (IMAGE_EXTS.has(ext)) {
      // Imagens precisam bater com sec da coleção
      if (sec === null) continue;
      if (!secsSet.has(sec)) continue;

      const imagesList = imagesByAcq.get(acqId) ?? [];
      imagesList.push({
        sec,
        ext,
        link: doc.link,
      });
      imagesByAcq.set(acqId, imagesList);

    } else {
      // Arquivos não-imagem: um por extensão por acq_id
      let filesList = filesByAcq.get(acqId);
      if (!filesList) {
        filesList = [];
        filesByAcq.set(acqId, filesList);
      }

      const exists = filesList.some((f) => f.ext === ext);
      if (!exists) {
        filesList.push({
          ext,
          link: doc.link,
        });
      }
    }
  }

  // 6. Montar resposta final no formato esperado
  const items: CollectionSecondsWithLinksItem[] = [];

  for (const [acqId, secsSet] of secsByAcq.entries()) {
    const secs = Array.from(secsSet).sort((a, b) => a - b);
    const images = imagesByAcq.get(acqId) ?? [];
    const files = filesByAcq.get(acqId) ?? [];

    items.push({
      acq_id: acqId,
      secs,
      images,
      files,
    });
  }

  // Ordena por acq_id para consistência
  items.sort((a, b) => (a.acq_id < b.acq_id ? -1 : a.acq_id > b.acq_id ? 1 : 0));

  return {
    collectionId: collection.id,
    name: collection.name,
    description: collection.description,
    items,
  };
}
