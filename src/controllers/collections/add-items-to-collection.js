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
exports.AddItemsToCollectionController = void 0;
const collections_service_1 = require("../../services/collections-service");
class AddItemsToCollectionController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const user = request.user;
            if (!user || !user.id) {
                return reply.code(401).send({ error: "Unauthorized" });
            }
            const { collectionId } = request.params;
            const body = request.body;
            const items = (_a = body === null || body === void 0 ? void 0 : body.items) !== null && _a !== void 0 ? _a : [];
            if (!Array.isArray(items) || items.length === 0) {
                return reply
                    .code(400)
                    .send({ error: "Body must contain a non-empty 'items' array." });
            }
            const result = yield (0, collections_service_1.addItemsToCollectionService)(user.id, collectionId, items);
            if (!result) {
                return reply.code(404).send({ error: "Collection not found" });
            }
            return reply.send(result);
        });
    }
}
exports.AddItemsToCollectionController = AddItemsToCollectionController;
