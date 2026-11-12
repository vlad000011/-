import { describe, it, expect } from "vitest";

describe("pagination input rules", () => {
  it("normalizes page and limit values", () => {
    const page = Math.max(1, Number("0") || 1);
    const limit = Math.min(30, Math.max(1, Number("100") || 9));
    expect(page).toBe(1);
    expect(limit).toBe(30);
  });
  it("uses default page size for invalid input", () => {
    const limit = Math.min(30, Math.max(1, Number("abc") || 9));
    expect(limit).toBe(9);
  });
  it("supports search terms as strings", () => {
    expect(String("велосипед").trim()).toBe("велосипед");
  });
});
