import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../../tests/helpers/db";

const mocks = vi.hoisted(() => ({ viewer: null as unknown }));

vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () => mocks.viewer,
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

import { followUserAction, unfollowUserAction } from "./follow";

type User = Awaited<ReturnType<typeof createUser>>;

async function asViewer(user: User | null): Promise<void> {
  mocks.viewer = user;
}

describe("followUserAction ve unfollowUserAction", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("takip satırı oluşturur ve FOLLOW bildirimini yalnız ilk seferde yazar", async () => {
    const viewer = await createUser();
    const target = await createUser();
    await asViewer(viewer);

    expect(await followUserAction(target.id)).toEqual({ ok: true });
    expect(await followUserAction(target.id)).toEqual({ ok: true });

    expect(await db.follow.count({ where: { followerId: viewer.id, followingId: target.id } })).toBe(1);
    const notes = await db.notification.findMany({ where: { userId: target.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.type).toBe("FOLLOW");
    expect(notes[0]?.actorId).toBe(viewer.id);
  });

  it("kendini takip edemez", async () => {
    const viewer = await createUser();
    await asViewer(viewer);

    const result = await followUserAction(viewer.id);
    expect(result.ok).toBe(false);
    expect(await db.follow.count()).toBe(0);
  });

  it("engellenmiş kişiyi takip edemez (iki yön)", async () => {
    const viewer = await createUser();
    const target = await createUser();
    await db.block.create({ data: { blockerId: target.id, blockedId: viewer.id } });
    await asViewer(viewer);

    const result = await followUserAction(target.id);
    expect(result.ok).toBe(false);
    expect(await db.follow.count()).toBe(0);
  });

  it("doğrulanmamış hedef takip edilemez", async () => {
    const viewer = await createUser();
    const target = await createUser({ verificationStatus: "PENDING" });
    await asViewer(viewer);

    const result = await followUserAction(target.id);
    expect(result).toEqual({ ok: false, error: "Yalnızca doğrulanmış kullanıcılar takip edilebilir." });
  });

  it("doğrulanmamış görüntüleyen takip edemez", async () => {
    const viewer = await createUser({ verificationStatus: "UNVERIFIED" });
    const target = await createUser();
    await asViewer(viewer);

    const result = await followUserAction(target.id);
    expect(result).toEqual({ ok: false, error: "Bu işlem için belgeni doğrulaman gerekiyor." });
  });

  it("takibi bırakır", async () => {
    const viewer = await createUser();
    const target = await createUser();
    await db.follow.create({ data: { followerId: viewer.id, followingId: target.id } });
    await asViewer(viewer);

    expect(await unfollowUserAction(target.id)).toEqual({ ok: true });
    expect(await db.follow.count({ where: { followerId: viewer.id } })).toBe(0);
  });
});
