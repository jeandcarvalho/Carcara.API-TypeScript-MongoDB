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
exports.SearchAcquisitionController = void 0;
const SearchAcquisitionService_1 = require("../services/SearchAcquisitionService");
class SearchAcquisitionController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = request.query;
                if (!query.acq_id) {
                    return reply
                        .status(400)
                        .send({ error: "Parameter 'acq_id' is required." });
                }
                const service = new SearchAcquisitionService_1.SearchAcquisitionService();
                const result = yield service.execute(query);
                return reply.send(result);
            }
            catch (err) {
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
        });
    }
}
exports.SearchAcquisitionController = SearchAcquisitionController;
