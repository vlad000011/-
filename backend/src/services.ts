import { prisma } from "./prisma";

export async function audit(userId: string | undefined, action: string, details?: string) {
  await prisma.auditLog.create({ data: { userId, action, details } });
}
export async function listListings(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(30, Math.max(1, Number(query.limit) || 9));
  const where: any = { status: "ACTIVE" };
  if (query.q) where.OR = [{ title: { contains: String(query.q), mode: "insensitive" } }, { description: { contains: String(query.q), mode: "insensitive" } }];
  if (query.categoryId) where.categoryId = String(query.categoryId);
  if (query.city) where.city = { contains: String(query.city), mode: "insensitive" };
  const orderBy = query.sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" };
  const [items, total] = await Promise.all([
    prisma.listing.findMany({ where, include: { owner: { select: { id: true, name: true } }, category: true, images: true }, orderBy: orderBy as any, skip: (page-1)*limit, take: limit }),
    prisma.listing.count({ where })
  ]);
  return { items, page, limit, total, pages: Math.ceil(total/limit) };
}
