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
exports.GetCollectionSecondsWithLinksController = void 0;
const getCollectionSecondsWithLinksService_1 = require("../services/getCollectionSecondsWithLinksService");
class GetCollectionSecondsWithLinksController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = request.user_id;
            const { collectionId } = request.params;
            if (!userId) {
                return reply.status(401).send({ error: "UNAUTHORIZED" });
            }
            if (!collectionId) {
                return reply.status(400).send({ error: "COLLECTION_ID_REQUIRED" });
            }
            const result = yield (0, getCollectionSecondsWithLinksService_1.getCollectionSecondsWithLinksService)(userId, collectionId);
            if (!result) {
                return reply
                    .status(404)
                    .send({ error: "COLLECTION_NOT_FOUND_OR_FORBIDDEN" });
            }
            return reply.send(result);
        });
    }
}
exports.GetCollectionSecondsWithLinksController = GetCollectionSecondsWithLinksController;
