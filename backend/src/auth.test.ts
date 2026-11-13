import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

const { refreshCreate, refreshFindUnique, refreshDelete } = vi.hoisted(() => ({
  refreshCreate: vi.fn(), refreshFindUnique: vi.fn(), refreshDelete: vi.fn()
}));

vi.mock("./prisma", () => ({
  prisma: { refreshToken: {
    create: refreshCreate,
    findUnique: refreshFindUnique,
    delete: refreshDelete
  } }
}));

import { allowRoles, hashPassword, issueTokens, refreshSession, requireAuth, signAccess, verifyPassword } from "./auth";

function responseMock() {
  const res: any = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as Response;
}

describe("authentication helpers", () => {
  afterEach(() => vi.clearAllMocks());

  it("hashes passwords and verifies only the matching password", async () => {
    const hash = await hashPassword("CorrectPass123");
    expect(hash).not.toBe("CorrectPass123");
    await expect(verifyPassword("CorrectPass123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("issues access and refresh tokens and stores only the refresh token hash", async () => {
    refreshCreate.mockResolvedValue({});
    const result = await issueTokens({
      id: "u1", email: "u@example.test", roles: [{ role: { name: "USER" } }]
    });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user).toEqual({ id: "u1", email: "u@example.test", roles: ["USER"] });
    expect(refreshCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "u1", tokenHash: expect.any(String), expiresAt: expect.any(Date) }) });
    expect(refreshCreate.mock.calls[0][0].data.tokenHash).not.toBe(result.refreshToken);
  });

  it("rejects requests without a bearer token", () => {
    const req: any = { headers: {} };
    const res = responseMock();
    const next = vi.fn() as NextFunction;
    requireAuth(req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a valid access token and rejects an invalid one", () => {
    const next = vi.fn() as NextFunction;
    const goodReq: any = { headers: { authorization: `Bearer ${signAccess({ id: "u1", email: "u@example.test", roles: ["USER"] })}` } };
    requireAuth(goodReq as Request, responseMock(), next);
    expect(goodReq.user.id).toBe("u1");
    expect(next).toHaveBeenCalledTimes(1);

    const badRes = responseMock();
    requireAuth({ headers: { authorization: "Bearer broken" } } as Request, badRes, vi.fn());
    expect(badRes.status).toHaveBeenCalledWith(401);
  });

  it("enforces role access", () => {
    const middleware = allowRoles("ADMIN");
    const denied = responseMock();
    const next = vi.fn() as NextFunction;
    middleware({} as Request, denied, next);
    expect(denied.status).toHaveBeenCalledWith(403);
    middleware({ user: { roles: ["ADMIN"] } } as any, responseMock(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rotates a valid refresh token and rejects unknown tokens", async () => {
    refreshCreate.mockResolvedValue({});
    const issued = await issueTokens({ id: "u2", email: "u2@example.test", roles: [{ role: { name: "USER" } }] });
    refreshFindUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "u2", email: "u2@example.test", isBlocked: false, roles: [{ role: { name: "USER" } }] }
    });
    refreshDelete.mockResolvedValue({});
    const rotated = await refreshSession(issued.refreshToken);
    expect(refreshDelete).toHaveBeenCalled();
    expect(rotated.refreshToken).not.toBe(issued.refreshToken);

    refreshFindUnique.mockResolvedValue(null);
    await expect(refreshSession(issued.refreshToken)).rejects.toThrow("Refresh token недействителен");
  });
});
