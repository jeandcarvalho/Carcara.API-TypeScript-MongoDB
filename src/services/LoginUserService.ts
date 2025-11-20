// src/services/LoginUserService.ts
import prismaClient from "../prisma";
import { compare } from "bcryptjs";
import jwt from "jsonwebtoken";

type LoginUserRequest = {
  email: string;
  password: string;
};

class LoginUserService {
  async execute({ email, password }: LoginUserRequest) {
    if (!email || !password) {
      throw new Error("EMAIL_OR_PASSWORD_MISSING");
    }

    const emailTrimmed = email.trim().toLowerCase();

    const user = await prismaClient.user.findUnique({
      where: { email: emailTrimmed },
    });

    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const passwordMatch = await compare(password, user.passwordHash);

    if (!passwordMatch) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const secret = process.env.JWT_SECRET || "dev-secret-change-me";

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
      },
      secret,
      {
        expiresIn: "7d",
      }
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    };
  }
}

export { LoginUserService };
