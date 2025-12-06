// src/services/publicGetLLMResultContextService.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type PublicGetLLMResultContextParams = {
  collectionId: string;
  testName: string;
  llmModel: string;
  promptType: string;
  acq_id: string;
  sec: number;
};

export async function publicGetLLMResultContextService(
  params: PublicGetLLMResultContextParams
) {
  const { collectionId, testName, llmModel, promptType, acq_id, sec } = params;

  // 1) Buscar o LLMResult correspondente (sem precisar de user_id)
  const llmResult = await prisma.lLMResult.findFirst({
    where: {
      collectionId,
      acq_id,
      centerSec: sec,
      testName,
      llmModel,
      promptType,
    },
  });

  if (!llmResult) {
    return {
      error: "LLM_RESULT_NOT_FOUND",
      details:
        "No LLMResult found for the given collectionId, acq_id, center_sec, testName, llmModel and promptType.",
    };
  }

  // Garantir que temos a lista completa de secs usados na janela
  const secsList = llmResult.secs && llmResult.secs.length > 0
    ? llmResult.secs
    : [llmResult.centerSec];

  // 2) Tentar converter acq_id (string) para número para cruzar com Big1Hz.acq_id
  let numericAcqId: number | null = null;
  if (/^\d+$/.test(acq_id)) {
    numericAcqId = Number(acq_id);
  }

  // 3) Buscar os documentos do Big1Hz para os secs dessa janela
  //    Usamos OR para cobrir possíveis mapeamentos de acq_id.
  const bigDocs = await prisma.big1Hz.findMany({
    where: {
      sec: { in: secsList },
      OR: [
        numericAcqId !== null ? { acq_id: numericAcqId } : undefined,
        { acq_id_raw: acq_id },
        { acq_name: acq_id },
      ].filter(Boolean) as any,
    },
    orderBy: { sec: "asc" },
  });

  // 4) Montar timeline com dados CAN, YOLO e LINKS para cada sec
  const timeline = secsList.map((s) => {
    const doc = bigDocs.find((d) => d.sec === s);

    if (!doc) {
      return {
        sec: s,
        can: null,
        yolo: [],
        links: [],
      };
    }

    // CAN: pegamos apenas os campos relevantes para o teste
    const can = doc.can
      ? {
          VehicleSpeed: (doc.can as any).VehicleSpeed ?? null,
          SteeringWheelAngle: (doc.can as any).SteeringWheelAngle ?? null,
          BrakeInfoStatus: (doc.can as any).BrakeInfoStatus ?? null,
        }
      : null;

    // YOLO: lista de objetos relevantes
    const yolo = Array.isArray(doc.yolo)
      ? doc.yolo.map((det: any) => ({
          track_id: det.track_id,
          class: det.class,
          conf: det.conf,
          dist_m: det.dist_m,
          rel_to_ego: det.rel_to_ego,
        }))
      : [];

    // LINKS: filtrando imagens (jpg/jpeg/png) para os thumbs
    const links = Array.isArray(doc.links)
      ? doc.links.filter((lk: any) => {
          const ext = (lk.ext || "").toLowerCase();
          return ["jpg", "jpeg", "png"].includes(ext);
        })
      : [];

    return {
      sec: s,
      can,
      yolo,
      links,
    };
  });

  // 5) Contexto rico apenas do center_sec (block, overpass, semseg)
  const centerDoc = bigDocs.find((d) => d.sec === llmResult.centerSec) || null;

  const center_context = centerDoc
    ? {
        block: centerDoc.block || null,      // meteo.period, meteo.condition, vehicle...
        overpass: centerDoc.overpass || null, // city, state, country, road, highway, landuse, etc.
        semseg: centerDoc.semseg || null,     // building, vegetation, sidewalk_left/right...
      }
    : {
        block: null,
        overpass: null,
        semseg: null,
      };

  // 6) Montar metadados do teste LLM (parte 1 da resposta)
  const meta = {
    id: llmResult.id,
    collectionId: llmResult.collectionId,
    acq_id: llmResult.acq_id,
    center_sec: llmResult.centerSec,
    secs: secsList,
    test_name: llmResult.testName,
    llm_model: llmResult.llmModel,
    prompt_type: llmResult.promptType,
    prompt_text: llmResult.prompt ?? null,
    system_prompt: (llmResult as any).system_prompt ?? null, // caso exista no schema
    answer: llmResult.response ?? null,
    total_tokens: llmResult.totalTokens ?? null,
    response_time_s: llmResult.latencyMs ?? null,
    createdAt: llmResult.createdAt,
    // se você tiver collectionName no schema:
    collectionName: (llmResult as any).collectionName ?? null,
  };

  return {
    meta,
    timeline,
    center_context,
  };
}
