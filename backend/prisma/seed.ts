import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  for (const name of Object.values(RoleName)) await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  const categories = ["Электроника", "Книги", "Одежда", "Для дома", "Спорт", "Хобби"];
  for (const name of categories) await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  const accounts = [
    ["user@swapspace.local", "User123!", "Алексей", "USER"],
    ["moderator@swapspace.local", "Moderator123!", "Модератор", "MODERATOR"],
    ["admin@swapspace.local", "Admin123!", "Администратор", "ADMIN"]
  ] as const;
  for (const [email, password, name, roleName] of accounts) {
    const user = await prisma.user.upsert({
      where: { email }, update: {},
      create: { email, name, passwordHash: await bcrypt.hash(password, 10),
        roles: { create: { role: { connect: { name: roleName as RoleName } } } } }
    });
    if (roleName === "USER" && await prisma.listing.count() === 0) {
      const category = await prisma.category.findFirst({ where: { name: "Книги" } });
      if (category) await prisma.listing.create({ data: {
        title: "Классическая литература", description: "Набор книг в хорошем состоянии. Готов обменять на фантастику.",
        city: "Москва", exchangeFor: "Фантастика", ownerId: user.id, categoryId: category.id
      }});
    }
  }
}
main().finally(() => prisma.$disconnect());
