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
exports.ensureAuthenticated = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function ensureAuthenticated(request, reply) {
    return __awaiter(this, void 0, void 0, function* () {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return reply.status(401).send({ error: "Token não informado." });
        }
        const [, token] = authHeader.split(" "); // "Bearer token"
        if (!token) {
            return reply.status(401).send({ error: "Token mal formatado." });
        }
        try {
            const secret = process.env.JWT_SECRET || "dev-secret-change-me";
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            // Anexa info do usuário à request
            request.user = {
                id: decoded.sub,
                email: decoded.email,
            };
        }
        catch (err) {
            console.error("[ensureAuthenticated] Erro ao validar token:", err);
            return reply.status(401).send({ error: "Token inválido ou expirado." });
        }
    });
}
exports.ensureAuthenticated = ensureAuthenticated;
