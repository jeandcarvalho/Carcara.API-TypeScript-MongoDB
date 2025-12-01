import prismaClient from "../prisma";

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

/**
 * Retorna, para uma coleção de um usuário, todos os (acq_id, sec) existentes
 * e anexa os links correspondentes da collection `links`:
 *
 * - images: apenas extensões de imagem (jpg/png/webp/gif) com sec definido.
 * - files: demais extensões (csv/mf4/blf/avi/etc.), agregadas por acq_id.
 */
export async function getCollectionSecondsWithLinksService(
  userId: string,
  collectionId: string
): Promise<CollectionSecondsWithLinksResult | null> {
  // 1) Validar se a coleção existe e pertence ao usuário
  const collection = await prismaClient.collection.findFirst({
    where: {
      id: collectionId,
      userId,
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (!collection) {
    return null;
  }

  // 2) Buscar todos os items da coleção (acq_id + sec)
  const rawItems = await prismaClient.collectionItem.findMany({
    where: {
      collectionId: collectionId,
    },
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

  // 3) Agrupar segundos por acq_id
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

  // 4) Buscar todos os links correspondentes a esses acq_id na collection `links`
  //    (vai trazer imagens e arquivos em geral)
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

  // 5) Mapear links em dois mapas: imagens e arquivos, indexados por acq_id
  const imagesByAcq = new Map<string, CollectionImageLink[]>();
  const filesByAcq = new Map<string, CollectionFileLink[]>();

  for (const doc of linksDocs) {
    const acqId = doc.acq_id;
    const sec = doc.sec ?? null;

    // Normaliza extensão: lowercase e sem ponto
    const rawExt = doc.ext || "";
    const normalizedExt = rawExt.toLowerCase().replace(/^\./, "");

    const baseFile: CollectionFileLink = {
      ext: normalizedExt,
      link: doc.link,
    };

    // Se for imagem e tiver sec, vai pra lista de imagens
    if (sec !== null && IMAGE_EXTS.has(normalizedExt)) {
      if (!imagesByAcq.has(acqId)) {
        imagesByAcq.set(acqId, []);
      }

      imagesByAcq.get(acqId)!.push({
        sec,
        ext: normalizedExt,
        link: doc.link,
      });
    } else {
      // Demais arquivos vão para "files" (um conjunto por acq_id)
      if (!filesByAcq.has(acqId)) {
        filesByAcq.set(acqId, []);
      }

      // Evita duplicar o mesmo ext+link várias vezes
      const existing = filesByAcq.get(acqId)!;
      const alreadyExists = existing.some(
        (f) => f.ext === baseFile.ext && f.link === baseFile.link
      );
      if (!alreadyExists) {
        existing.push(baseFile);
      }
    }
  }

  // 6) Construir o array final de items por acq_id
  const items: CollectionSecondsWithLinksItem[] = [];

  // Ordena acq_id para ter uma navegação previsível
  const sortedAcqIds = Array.from(secsByAcq.keys()).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );

  for (const acqId of sortedAcqIds) {
    const secsSet = secsByAcq.get(acqId);
    if (!secsSet) continue;

    const secsArray = Array.from(secsSet).sort((a, b) => a - b);

    // Filtra imagens somente para os secs que estão na coleção
    const allImages = imagesByAcq.get(acqId) || [];
    const filteredImages = allImages
      .filter((img) => secsSet.has(img.sec))
      .sort((a, b) => a.sec - b.sec);

    const files = filesByAcq.get(acqId) || [];

    items.push({
      acq_id: acqId,
      secs: secsArray,
      images: filteredImages,
      files,
    });
  }

  return {
    collectionId: collection.id,
    name: collection.name,
    description: collection.description,
    items,
  };
}
