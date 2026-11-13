import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./prisma";
import type { AuthRequest, AuthUser } from "./types";

const accessSecret: string =
  process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me";

const refreshSecret: string =
  process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me";

export function signAccess(user: AuthUser): string {
  const expiresIn = (
    process.env.ACCESS_TOKEN_TTL || "15m"
  ) as jwt.SignOptions["expiresIn"];

  return jwt.sign(user, accessSecret, { expiresIn });
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authReq = req as AuthRequest;

  const token = authReq.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return res.status(401).json({
      error: "Требуется авторизация"
    });
  }

  try {
    authReq.user = jwt.verify(token, accessSecret) as AuthUser;
    return next();
  } catch {
    return res.status(401).json({
      error: "Недействительный или просроченный токен"
    });
  }
}

export function allowRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;

    if (
      !authReq.user ||
      !authReq.user.roles.some(role => allowedRoles.includes(role))
    ) {
      return res.status(403).json({
        error: "Недостаточно прав"
      });
    }

    return next();
  };
}

export async function issueTokens(user: {
  id: string;
  email: string;
  roles: { role: { name: string } }[];
}) {
  const payload: AuthUser = {
    id: user.id,
    email: user.email,
    roles: user.roles.map(item => item.role.name)
  };

  const accessToken = signAccess(payload);

  const refreshExpiresIn = (
    process.env.REFRESH_TOKEN_TTL || "7d"
  ) as jwt.SignOptions["expiresIn"];

  // A unique JWT ID guarantees a new refresh token even when rotation
  // happens within the same second (JWT timestamps otherwise may be identical).
  const refreshToken = jwt.sign(
    { sub: user.id, jti: crypto.randomUUID() },
    refreshSecret,
    { expiresIn: refreshExpiresIn }
  );

  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  );

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt
    }
  });

  return {
    accessToken,
    refreshToken,
    user: payload
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function refreshSession(token: string) {
  const decoded = jwt.verify(
    token,
    refreshSecret
  ) as jwt.JwtPayload & { sub: string };

  if (!decoded.sub) {
    throw new Error(
      "Refresh token не содержит идентификатор пользователя"
    );
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          roles: {
            include: { role: true }
          }
        }
      }
    }
  });

  if (
    !stored ||
    stored.expiresAt < new Date() ||
    stored.user.isBlocked
  ) {
    throw new Error("Refresh token недействителен");
  }

  await prisma.refreshToken.delete({
    where: { tokenHash }
  });

  return issueTokens(stored.user);
}