"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicGetLLMResultContextService = publicGetLLMResultContextService;
// src/services/publicGetLLMResultContextService.ts
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function publicGetLLMResultContextService(params) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const { collectionId, testName, llmModel, promptType, acq_id, sec } = params;
        // 1) Buscar o LLMResult correspondente (sem precisar de user_id)
        const llmResult = yield prisma.lLMResult.findFirst({
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
                details: "No LLMResult found for the given collectionId, acq_id, center_sec, testName, llmModel and promptType.",
            };
        }
        // Garantir que temos a lista completa de secs usados na janela
        const secsList = llmResult.secs && llmResult.secs.length > 0
            ? llmResult.secs
            : [llmResult.centerSec];
        // 2) Tentar converter acq_id (string) para número para cruzar com Big1Hz.acq_id
        let numericAcqId = null;
        if (/^\d+$/.test(acq_id)) {
            numericAcqId = Number(acq_id);
        }
        // 3) Buscar os documentos do Big1Hz para os secs dessa janela
        //    Usamos OR para cobrir possíveis mapeamentos de acq_id.
        const bigDocs = yield prisma.big1Hz.findMany({
            where: {
                sec: { in: secsList },
                OR: [
                    numericAcqId !== null ? { acq_id: numericAcqId } : undefined,
                    { acq_id_raw: acq_id },
                    { acq_name: acq_id },
                ].filter(Boolean),
            },
            orderBy: { sec: "asc" },
        });
        // 4) Montar timeline com dados CAN, YOLO e LINKS para cada sec
        const timeline = secsList.map((s) => {
            var _a, _b, _c;
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
                    VehicleSpeed: (_a = doc.can.VehicleSpeed) !== null && _a !== void 0 ? _a : null,
                    SteeringWheelAngle: (_b = doc.can.SteeringWheelAngle) !== null && _b !== void 0 ? _b : null,
                    BrakeInfoStatus: (_c = doc.can.BrakeInfoStatus) !== null && _c !== void 0 ? _c : null,
                }
                : null;
            // YOLO: lista de objetos relevantes
            const yolo = Array.isArray(doc.yolo)
                ? doc.yolo.map((det) => ({
                    track_id: det.track_id,
                    class: det.class,
                    conf: det.conf,
                    dist_m: det.dist_m,
                    rel_to_ego: det.rel_to_ego,
                }))
                : [];
            // LINKS: filtrando imagens (jpg/jpeg/png) para os thumbs
            const links = Array.isArray(doc.links)
                ? doc.links.filter((lk) => {
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
                block: centerDoc.block || null, // meteo.period, meteo.condition, vehicle...
                overpass: centerDoc.overpass || null, // city, state, country, road, highway, landuse, etc.
                semseg: centerDoc.semseg || null, // building, vegetation, sidewalk_left/right...
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
            prompt_text: (_a = llmResult.prompt) !== null && _a !== void 0 ? _a : null,
            system_prompt: (_b = llmResult.system_prompt) !== null && _b !== void 0 ? _b : null, // caso exista no schema
            answer: (_c = llmResult.response) !== null && _c !== void 0 ? _c : null,
            total_tokens: (_d = llmResult.totalTokens) !== null && _d !== void 0 ? _d : null,
            response_time_s: (_e = llmResult.latencyMs) !== null && _e !== void 0 ? _e : null,
            createdAt: llmResult.createdAt,
            // se você tiver collectionName no schema:
            collectionName: (_f = llmResult.collectionName) !== null && _f !== void 0 ? _f : null,
        };
        return {
            meta,
            timeline,
            center_context,
        };
    });
}
