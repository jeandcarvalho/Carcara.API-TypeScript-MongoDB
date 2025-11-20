// src/controllers/SearchAcquisitionController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  SearchAcquisitionService,
} from "../services/SearchAcquisitionService";

type AcquisitionQuery = {
  acq_id?: string;
  [key: string]: any;
};

class SearchAcquisitionController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as AcquisitionQuery;

      if (!query.acq_id) {
        return reply
          .status(400)
          .send({ error: "Parameter 'acq_id' is required." });
      }

      const service = new SearchAcquisitionService();
      const result = await service.execute(query);

      return reply.send(result);
    } catch (err: any) {
      console.error("[SearchAcquisitionController] Error:", err);

      if (err.message === "ACQ_ID_REQUIRED") {
        return reply.status(400).send({ error: "acq_id is required." });
      }
      if (err.message === "ACQ_ID_INVALID") {
        return reply
          .status(400)
          .send({ error: "acq_id must be a numeric ID (e.g. 20240129205623)." });
      }

      return reply
        .status(500)
        .send({ error: "Error searching acquisition data." });
    }
  }
}

export { SearchAcquisitionController };
