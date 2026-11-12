import express, { type Request, type RequestHandler, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import swaggerUi from "swagger-ui-express";
import { z } from "zod";
import { prisma } from "./prisma";
import { allowRoles, hashPassword, issueTokens, refreshSession, requireAuth, verifyPassword } from "./auth";
import { audit, listListings } from "./services";
import type { AuthRequest } from "./types";

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.resolve("uploads")));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

const uploadDir = path.resolve("uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) =>
    cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase())
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
});

const wrap = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => unknown
): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "swapspace-api" })
);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup({
  openapi: "3.0.3",
  info: { title: "SwapSpace API", version: "1.0.0" },
  servers: [{ url: "http://localhost:3000" }],
  paths: {
    "/api/auth/register": { post: { summary: "Регистрация" } },
    "/api/auth/login": { post: { summary: "Вход" } },
    "/api/listings": {
      get: { summary: "Каталог объявлений" },
      post: { summary: "Создать объявление" }
    },
    "/api/listings/{id}": {
      get: { summary: "Карточка объявления" },
      patch: { summary: "Изменить объявление" },
      delete: { summary: "Удалить объявление" }
    }
  }
}));

// AUTH

app.post("/api/auth/register", wrap(async (req, res) => {
  const data = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2).max(60)
  }).parse(req.body);

  const exists = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() }
  });

  if (exists) {
    return res.status(409).json({ error: "Email уже зарегистрирован" });
  }

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash: await hashPassword(data.password),
      roles: {
        create: {
          role: { connect: { name: "USER" } }
        }
      }
    },
    include: { roles: { include: { role: true } } }
  });

  await audit(user.id, "REGISTER");
  res.status(201).json(await issueTokens(user));
}));

app.post("/api/auth/login", wrap(async (req, res) => {
  const data = z.object({
    email: z.string().email(),
    password: z.string()
  }).parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
    include: { roles: { include: { role: true } } }
  });

  if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Неверный email или пароль" });
  }

  if (user.isBlocked) {
    return res.status(403).json({ error: "Аккаунт заблокирован" });
  }

  await audit(user.id, "LOGIN");
  res.json(await issueTokens(user));
}));

app.post("/api/auth/refresh", wrap(async (req, res) => {
  try {
    const { refreshToken } = z.object({
      refreshToken: z.string()
    }).parse(req.body);

    res.json(await refreshSession(refreshToken));
  } catch {
    res.status(401).json({ error: "Не удалось обновить сессию" });
  }
}));

app.post("/api/auth/logout", requireAuth, wrap(async (req: AuthRequest, res) => {
  const token = req.body.refreshToken;

  if (token) {
    const hash = crypto.createHash("sha256").update(String(token)).digest("hex");

    await prisma.refreshToken.deleteMany({
      where: {
        tokenHash: hash,
        userId: req.user!.id
      }
    });
  }

  res.json({ message: "Выход выполнен" });
}));

app.post("/api/auth/forgot-password", wrap(async (req, res) => {
  const { email } = z.object({
    email: z.string().email()
  }).parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  // Учебный режим: токен показывается в ответе вместо отправки письма.
  const resetToken = user
    ? crypto.randomBytes(24).toString("hex")
    : undefined;

  res.json({
    message: "Если аккаунт существует, инструкция будет отправлена",
    ...(resetToken ? { demoResetToken: resetToken } : {})
  });
}));

// CATEGORIES

app.get("/api/categories", wrap(async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" }
  });

  res.json(categories);
}));

// LISTINGS

app.get("/api/listings", wrap(async (req, res) => {
  res.json(await listListings(req.query as any));
}));

app.get("/api/listings/:id", wrap(async (req, res) => {
  const item = await prisma.listing.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true } },
      category: true,
      images: true
    }
  });

  if (!item || item.status === "HIDDEN") {
    return res.status(404).json({ error: "Объявление не найдено" });
  }

  res.json(item);
}));

app.post("/api/listings", requireAuth, wrap(async (req: AuthRequest, res) => {
  const d = z.object({
    title: z.string().min(3).max(100),
    description: z.string().min(10).max(3000),
    city: z.string().min(2),
    categoryId: z.string(),
    condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]).default("GOOD"),
    exchangeFor: z.string().optional()
  }).parse(req.body);

  const item = await prisma.listing.create({
    data: { ...d, ownerId: req.user!.id },
    include: { category: true, images: true }
  });

  await audit(req.user!.id, "LISTING_CREATE", item.id);
  res.status(201).json(item);
}));

app.patch("/api/listings/:id", requireAuth, wrap(async (req: AuthRequest, res) => {
  const item = await prisma.listing.findUnique({
    where: { id: req.params.id }
  });

  if (!item) {
    return res.status(404).json({ error: "Объявление не найдено" });
  }

  if (
    item.ownerId !== req.user!.id &&
    !req.user!.roles.some(r => ["MODERATOR", "ADMIN"].includes(r))
  ) {
    return res.status(403).json({ error: "Нет доступа" });
  }

  const d = z.object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().min(10).max(3000).optional(),
    city: z.string().min(2).optional(),
    categoryId: z.string().optional(),
    condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]).optional(),
    exchangeFor: z.string().optional(),
    status: z.enum(["ACTIVE", "HIDDEN", "EXCHANGED"]).optional()
  }).parse(req.body);

  const updated = await prisma.listing.update({
    where: { id: item.id },
    data: d,
    include: { category: true, images: true }
  });

  await audit(req.user!.id, "LISTING_UPDATE", item.id);
  res.json(updated);
}));

app.delete("/api/listings/:id", requireAuth, wrap(async (req: AuthRequest, res) => {
  const item = await prisma.listing.findUnique({
    where: { id: req.params.id }
  });

  if (!item) {
    return res.status(404).json({ error: "Объявление не найдено" });
  }

  if (
    item.ownerId !== req.user!.id &&
    !req.user!.roles.some(r => ["MODERATOR", "ADMIN"].includes(r))
  ) {
    return res.status(403).json({ error: "Нет доступа" });
  }

  await prisma.listing.delete({ where: { id: item.id } });
  await audit(req.user!.id, "LISTING_DELETE", item.id);

  res.json({ message: "Объявление удалено" });
}));

app.post("/api/listings/:id/images", requireAuth, upload.single("image"), wrap(async (req: AuthRequest, res) => {
  const item = await prisma.listing.findUnique({
    where: { id: req.params.id }
  });

  if (!item) {
    return res.status(404).json({ error: "Объявление не найдено" });
  }

  if (
    item.ownerId !== req.user!.id &&
    !req.user!.roles.some(r => ["MODERATOR", "ADMIN"].includes(r))
  ) {
    return res.status(403).json({ error: "Нет доступа" });
  }

  if (!req.file) {
    return res.status(400).json({
      error: "Выберите изображение JPEG, PNG или WebP до 5 МБ"
    });
  }

  const image = await prisma.listingImage.create({
    data: {
      listingId: item.id,
      url: `/uploads/${req.file.filename}`
    }
  });

  res.status(201).json(image);
}));

// PROFILE

app.get("/api/me", requireAuth, wrap(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      bio: true,
      createdAt: true,
      roles: { include: { role: true } }
    }
  });

  res.json(user);
}));

app.patch("/api/me", requireAuth, wrap(async (req: AuthRequest, res) => {
  const d = z.object({
    name: z.string().min(2).max(60).optional(),
    bio: z.string().max(500).optional()
  }).parse(req.body);

  res.json(await prisma.user.update({
    where: { id: req.user!.id },
    data: d,
    select: { id: true, email: true, name: true, bio: true }
  }));
}));

app.post("/api/me/password", requireAuth, wrap(async (req: AuthRequest, res) => {
  const d = z.object({
    oldPassword: z.string(),
    newPassword: z.string().min(8)
  }).parse(req.body);

  const u = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id }
  });

  if (!(await verifyPassword(d.oldPassword, u.passwordHash))) {
    return res.status(400).json({ error: "Текущий пароль неверен" });
  }

  await prisma.user.update({
    where: { id: u.id },
    data: { passwordHash: await hashPassword(d.newPassword) }
  });

  await audit(u.id, "PASSWORD_CHANGE");
  res.json({ message: "Пароль изменён" });
}));

app.get("/api/me/listings", requireAuth, wrap(async (req: AuthRequest, res) =>
  res.json(await prisma.listing.findMany({
    where: { ownerId: req.user!.id },
    include: { category: true, images: true },
    orderBy: { createdAt: "desc" }
  }))
));

app.get("/api/favorites", requireAuth, wrap(async (req: AuthRequest, res) =>
  res.json(await prisma.favorite.findMany({
    where: { userId: req.user!.id },
    include: {
      listing: {
        include: {
          category: true,
          images: true,
          owner: { select: { id: true, name: true } }
        }
      }
    }
  }))
));

app.post("/api/favorites/:listingId", requireAuth, wrap(async (req: AuthRequest, res) => {
  await prisma.favorite.upsert({
    where: {
      userId_listingId: {
        userId: req.user!.id,
        listingId: req.params.listingId
      }
    },
    create: {
      userId: req.user!.id,
      listingId: req.params.listingId
    },
    update: {}
  });

  res.json({ saved: true });
}));

app.delete("/api/favorites/:listingId", requireAuth, wrap(async (req: AuthRequest, res) => {
  await prisma.favorite.deleteMany({
    where: {
      userId: req.user!.id,
      listingId: req.params.listingId
    }
  });

  res.json({ saved: false });
}));

// CONVERSATIONS

app.post("/api/conversations", requireAuth, wrap(async (req: AuthRequest, res) => {
  const { recipientId } = z.object({
    recipientId: z.string()
  }).parse(req.body);

  if (recipientId === req.user!.id) {
    return res.status(400).json({ error: "Нельзя создать диалог с собой" });
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { members: { some: { userId: req.user!.id } } },
        { members: { some: { userId: recipientId } } }
      ]
    }
  });

  const conversation = existing || await prisma.conversation.create({
    data: {
      members: {
        create: [
          { userId: req.user!.id },
          { userId: recipientId }
        ]
      }
    }
  });

  res.status(existing ? 200 : 201).json(conversation);
}));

app.get("/api/conversations", requireAuth, wrap(async (req: AuthRequest, res) =>
  res.json(await prisma.conversation.findMany({
    where: { members: { some: { userId: req.user!.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  }))
));

app.get("/api/conversations/:id/messages", requireAuth, wrap(async (req: AuthRequest, res) => {
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: req.params.id,
        userId: req.user!.id
      }
    }
  });

  if (!member) {
    return res.status(403).json({ error: "Нет доступа" });
  }

  res.json(await prisma.message.findMany({
    where: { conversationId: req.params.id },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" }
  }));
}));

app.post("/api/conversations/:id/messages", requireAuth, wrap(async (req: AuthRequest, res) => {
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: req.params.id,
        userId: req.user!.id
      }
    }
  });

  if (!member) {
    return res.status(403).json({ error: "Нет доступа" });
  }

  const { body } = z.object({
    body: z.string().min(1).max(2000)
  }).parse(req.body);

  res.status(201).json(await prisma.message.create({
    data: {
      body,
      conversationId: req.params.id,
      senderId: req.user!.id
    },
    include: { sender: { select: { id: true, name: true } } }
  }));
}));

// REPORTS AND MODERATION

app.post("/api/listings/:id/reports", requireAuth, wrap(async (req: AuthRequest, res) => {
  const { reason } = z.object({
    reason: z.string().min(5).max(500)
  }).parse(req.body);

  const report = await prisma.report.create({
    data: {
      reason,
      listingId: req.params.id,
      reporterId: req.user!.id
    }
  });

  await audit(req.user!.id, "REPORT_CREATE", report.id);
  res.status(201).json(report);
}));

app.get("/api/moderation/reports", requireAuth, allowRoles("MODERATOR", "ADMIN"), wrap(async (_req, res) =>
  res.json(await prisma.report.findMany({
    include: {
      listing: true,
      reporter: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: "desc" }
  }))
));

app.patch("/api/moderation/reports/:id", requireAuth, allowRoles("MODERATOR", "ADMIN"), wrap(async (req: AuthRequest, res) => {
  const { status } = z.object({
    status: z.enum(["OPEN", "REVIEWED", "REJECTED"])
  }).parse(req.body);

  const report = await prisma.report.update({
    where: { id: req.params.id },
    data: { status }
  });

  await audit(req.user!.id, "REPORT_UPDATE", report.id);
  res.json(report);
}));

// ADMIN

app.get("/api/admin/users", requireAuth, allowRoles("ADMIN"), wrap(async (_req, res) =>
  res.json(await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isBlocked: true,
      createdAt: true,
      roles: { include: { role: true } }
    },
    orderBy: { createdAt: "desc" }
  }))
));

app.patch("/api/admin/users/:id", requireAuth, allowRoles("ADMIN"), wrap(async (req: AuthRequest, res) => {
  const d = z.object({
    isBlocked: z.boolean().optional(),
    role: z.enum(["USER", "MODERATOR", "ADMIN"]).optional()
  }).parse(req.body);

  if (d.isBlocked !== undefined) {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isBlocked: d.isBlocked }
    });
  }

  if (d.role) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { name: d.role }
    });

    await prisma.userRole.deleteMany({
      where: { userId: req.params.id }
    });

    await prisma.userRole.create({
      data: {
        userId: req.params.id,
        roleId: role.id
      }
    });
  }

  await audit(req.user!.id, "USER_ADMIN_UPDATE", req.params.id);
  res.json({ message: "Пользователь обновлён" });
}));

app.get("/api/admin/stats", requireAuth, allowRoles("MODERATOR", "ADMIN"), wrap(async (_req, res) => {
  const [users, listings, active, reports] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.report.count({ where: { status: "OPEN" } })
  ]);

  res.json({
    users,
    listings,
    activeListings: active,
    openReports: reports
  });
}));

app.get("/api/admin/audit", requireAuth, allowRoles("ADMIN"), wrap(async (_req, res) =>
  res.json(await prisma.auditLog.findMany({
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100
  }))
));

// ERROR HANDLER

app.use((err: any, _req: any, res: any, _next: any) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: "Ошибка валидации",
      details: err.issues
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});