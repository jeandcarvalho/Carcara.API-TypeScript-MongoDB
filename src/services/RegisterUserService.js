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
exports.RegisterUserService = void 0;
// src/services/RegisterUserService.ts
const prisma_1 = __importDefault(require("../prisma"));
const bcryptjs_1 = require("bcryptjs");
class RegisterUserService {
    execute({ name, email, password }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!email || !password) {
                throw new Error("EMAIL_OR_PASSWORD_MISSING");
            }
            const emailTrimmed = email.trim().toLowerCase();
            // Verifica se já existe usuário com esse e-mail
            const existing = yield prisma_1.default.user.findUnique({
                where: { email: emailTrimmed },
            });
            if (existing) {
                throw new Error("USER_ALREADY_EXISTS");
            }
            // Gera hash da senha
            const passwordHash = yield (0, bcryptjs_1.hash)(password, 10);
            const user = yield prisma_1.default.user.create({
                data: {
                    name,
                    email: emailTrimmed,
                    passwordHash,
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    createdAt: true,
                },
            });
            return user;
        });
    }
}
exports.RegisterUserService = RegisterUserService;
