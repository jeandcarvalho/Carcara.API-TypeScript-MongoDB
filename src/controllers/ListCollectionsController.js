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
exports.ListCollectionsController = void 0;
const ListCollectionsService_1 = require("../services/ListCollectionsService");
class ListCollectionsController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = request.user;
                if (!user) {
                    return reply.status(401).send({ error: "Unauthorized." });
                }
                const service = new ListCollectionsService_1.ListCollectionsService();
                const collections = yield service.execute(user.id);
                return reply.send(collections);
            }
            catch (err) {
                console.error("[ListCollectionsController] Error:", err);
                return reply
                    .status(500)
                    .send({ error: "Error listing collections." });
            }
        });
    }
}
exports.ListCollectionsController = ListCollectionsController;
