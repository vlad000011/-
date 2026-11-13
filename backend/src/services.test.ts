import { beforeEach, describe, expect, it, vi } from "vitest";

const { listingFindMany, listingCount, auditCreate } = vi.hoisted(() => ({
  listingFindMany: vi.fn(),
  listingCount: vi.fn(),
  auditCreate: vi.fn()
}));

vi.mock("./prisma", () => ({
  prisma: {
    listing: { findMany: listingFindMany, count: listingCount },
    auditLog: { create: auditCreate }
  }
}));

import { audit, listListings } from "./services";

describe("backend services", () => {
  beforeEach(() => {
    listingFindMany.mockReset();
    listingCount.mockReset();
    auditCreate.mockReset();
  });

  it("normalizes pagination and applies default newest sorting", async () => {
    listingFindMany.mockResolvedValue([]);
    listingCount.mockResolvedValue(0);

    const result = await listListings({ page: "0", limit: "100" });

    expect(result).toEqual({ items: [], page: 1, limit: 30, total: 0, pages: 0 });
    expect(listingFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 30
    }));
  });

  it("combines search, category, city and condition filters and supports oldest sort", async () => {
    listingFindMany.mockResolvedValue([{ id: "listing-1" }]);
    listingCount.mockResolvedValue(1);

    const result = await listListings({
      q: "  книга ", categoryId: "cat-1", city: "Москва",
      condition: "GOOD", sort: "oldest", page: "2", limit: "5"
    });

    expect(result).toMatchObject({ page: 2, limit: 5, total: 1, pages: 1 });
    const args = listingFindMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      status: "ACTIVE", categoryId: "cat-1", condition: "GOOD",
      city: { contains: "Москва", mode: "insensitive" }
    });
    expect(args.where.OR).toHaveLength(2);
    expect(args.orderBy).toEqual({ createdAt: "asc" });
    expect(args.skip).toBe(5);
  });

  it("ignores unsupported condition values and caps page size", async () => {
    listingFindMany.mockResolvedValue([]);
    listingCount.mockResolvedValue(0);

    await listListings({ condition: "BROKEN", limit: "-4" });

    const args = listingFindMany.mock.calls[0][0];
    expect(args.where).toEqual({ status: "ACTIVE" });
    expect(args.take).toBe(1);
  });

  it("writes audit events with optional details", async () => {
    auditCreate.mockResolvedValue({ id: "audit-1" });
    await audit("user-1", "LOGIN", "from test");
    expect(auditCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", action: "LOGIN", details: "from test" }
    });
  });
});
