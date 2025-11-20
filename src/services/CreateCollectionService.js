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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCollectionService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
class CreateCollectionService {
    execute({ userId, name, description }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!name || !name.trim()) {
                throw new Error("NAME_REQUIRED");
            }
            const col = yield prisma_1.default.collection.create({
                data: {
                    userId,
                    name: name.trim(),
                    description: (description === null || description === void 0 ? void 0 : description.trim()) || null,
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    createdAt: true,
                },
            });
            return col;
        });
    }
}
exports.CreateCollectionService = CreateCollectionService;
