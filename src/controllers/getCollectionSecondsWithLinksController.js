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
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            const anyReq = request;
            // Tenta vários lugares comuns onde o middleware pode ter colocado o id
            const userId = (_d = (_b = (_a = anyReq.user_id) !== null && _a !== void 0 ? _a : anyReq.userId) !== null && _b !== void 0 ? _b : (_c = anyReq.user) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : (_e = anyReq.user) === null || _e === void 0 ? void 0 : _e._id;
            const { collectionId } = request.params;
            if (!userId) {
                // LOG pra você ver nos logs da Render o que está chegando
                console.log("[seconds-with-links] missing userId", {
                    authHeader: request.headers.authorization,
                    user_id: anyReq.user_id,
                    userId: anyReq.userId,
                    user: anyReq.user,
                });
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
