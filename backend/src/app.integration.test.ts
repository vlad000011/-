import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { listingFindMany, listingCount } = vi.hoisted(() => ({
  listingFindMany: vi.fn(),
  listingCount: vi.fn()
}));

vi.mock("./prisma", () => ({
  prisma: {
    listing: { findMany: listingFindMany, count: listingCount }
  }
}));

import { app } from "./app";
import { signAccess } from "./auth";

describe("SwapSpace HTTP API integration", () => {
  beforeEach(() => {
    listingFindMany.mockReset();
    listingCount.mockReset();
  });

  it("returns the health status endpoint", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "swapspace-api" });
  });

  it("serves catalog results and forwards combined filters to the listing service", async () => {
    listingFindMany.mockResolvedValue([{ id: "listing-1", title: "Книга" }]);
    listingCount.mockResolvedValue(1);

    const response = await request(app)
      .get("/api/listings")
      .query({ q: "книга", categoryId: "cat-1", city: "Москва", condition: "GOOD", sort: "oldest", page: 1, limit: 9 });

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([{ id: "listing-1", title: "Книга" }]);
    expect(listingFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ categoryId: "cat-1", condition: "GOOD" }),
      orderBy: { createdAt: "asc" }
    }));
  });

  it("rejects protected profile requests without authentication", async () => {
    const response = await request(app).get("/api/me");
    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/авторизац/i);
  });

  it("returns a validation error for malformed listing creation", async () => {
    const token = signAccess({ id: "user-1", email: "user@example.test", roles: ["USER"] });
    const response = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "x" });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Ошибка валидации");
  });
});
