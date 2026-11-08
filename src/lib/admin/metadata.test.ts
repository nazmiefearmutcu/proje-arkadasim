import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser,
  isAdmin: (user: { role: string }) => user.role === "ADMIN",
}));

import { ADMIN_HIDDEN_TITLE, adminMetadata } from "./metadata";

describe("adminMetadata", () => {
  beforeEach(() => getCurrentUser.mockReset());

  it("misafire yönetim başlığını göstermez", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await adminMetadata("Yönetim paneli")).toEqual({ title: ADMIN_HIDDEN_TITLE });
  });

  it("yönetici olmayan kullanıcıya yönetim başlığını göstermez", async () => {
    getCurrentUser.mockResolvedValue({ role: "USER" });
    expect(await adminMetadata("Şikayetler")).toEqual({ title: ADMIN_HIDDEN_TITLE });
  });

  it("yöneticiye gerçek başlığı verir", async () => {
    getCurrentUser.mockResolvedValue({ role: "ADMIN" });
    expect(await adminMetadata("Doğrulama kuyruğu")).toEqual({ title: "Doğrulama kuyruğu" });
  });
});
