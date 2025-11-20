// src/services/RegisterUserService.ts
import prismaClient from "../prisma";
import { hash } from "bcryptjs";

type RegisterUserRequest = {
  name?: string;
  email: string;
  password: string;
};

class RegisterUserService {
  async execute({ name, email, password }: RegisterUserRequest) {
    if (!email || !password) {
      throw new Error("EMAIL_OR_PASSWORD_MISSING");
    }

    const emailTrimmed = email.trim().toLowerCase();

    // Verifica se já existe usuário com esse e-mail
    const existing = await prismaClient.user.findUnique({
      where: { email: emailTrimmed },
    });

    if (existing) {
      throw new Error("USER_ALREADY_EXISTS");
    }

    // Gera hash da senha
    const passwordHash = await hash(password, 10);

    const user = await prismaClient.user.create({
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
  }
}

export { RegisterUserService };
