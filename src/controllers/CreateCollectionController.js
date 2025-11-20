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
exports.CreateCollectionController = void 0;
const CreateCollectionService_1 = require("../services/CreateCollectionService");
class CreateCollectionController {
    handle(request, reply) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = request.user;
                if (!user) {
                    return reply.status(401).send({ error: "Unauthorized." });
                }
                const { name, description } = request.body;
                const service = new CreateCollectionService_1.CreateCollectionService();
                const col = yield service.execute({
                    userId: user.id,
                    name,
                    description,
                });
                return reply.status(201).send(col);
            }
            catch (err) {
                console.error("[CreateCollectionController] Error:", err);
                if (err.message === "NAME_REQUIRED") {
                    return reply.status(400).send({ error: "Name is required." });
                }
                return reply
                    .status(500)
                    .send({ error: "Error creating collection." });
            }
        });
    }
}
exports.CreateCollectionController = CreateCollectionController;
