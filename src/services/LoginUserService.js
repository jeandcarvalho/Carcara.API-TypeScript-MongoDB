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
exports.LoginUserService = void 0;
// src/services/LoginUserService.ts
const prisma_1 = __importDefault(require("../prisma"));
const bcryptjs_1 = require("bcryptjs");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class LoginUserService {
    execute(_a) {
        return __awaiter(this, arguments, void 0, function* ({ email, password }) {
            if (!email || !password) {
                throw new Error("EMAIL_OR_PASSWORD_MISSING");
            }
            const emailTrimmed = email.trim().toLowerCase();
            const user = yield prisma_1.default.user.findUnique({
                where: { email: emailTrimmed },
            });
            if (!user) {
                throw new Error("INVALID_CREDENTIALS");
            }
            const passwordMatch = yield (0, bcryptjs_1.compare)(password, user.passwordHash);
            if (!passwordMatch) {
                throw new Error("INVALID_CREDENTIALS");
            }
            const secret = process.env.JWT_SECRET || "dev-secret-change-me";
            const token = jsonwebtoken_1.default.sign({
                sub: user.id,
                email: user.email,
            }, secret, {
                expiresIn: "7d",
            });
            return {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
                token,
            };
        });
    }
}
exports.LoginUserService = LoginUserService;
