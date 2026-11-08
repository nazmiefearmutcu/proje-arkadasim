import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../tests/helpers/db";
import { notify, notifyMany } from "./notify";

describe("notify", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("kullanıcının kendisine yaptığı eylem için bildirim atılmaz", async () => {
    const user = await createUser({ firstName: "Ali", lastName: "Yılmaz" });

    await notify({ userId: user.id, actorId: user.id, type: "FOLLOW" });

    expect(await db.notification.count({ where: { userId: user.id } })).toBe(0);
  });

  it("engellenmiş aktörün bildirimi atılmaz", async () => {
    const recipient = await createUser({ firstName: "Ali", lastName: "Yılmaz" });
    const actor = await createUser({ firstName: "Elif", lastName: "Kaya" });
    await db.block.create({ data: { blockerId: recipient.id, blockedId: actor.id } });

    await notify({ userId: recipient.id, actorId: actor.id, type: "FOLLOW" });

    expect(await db.notification.count({ where: { userId: recipient.id } })).toBe(0);
  });

  it("normal bildirim satır olarak dataJson ile yazılır", async () => {
    const recipient = await createUser({ firstName: "Ali", lastName: "Yılmaz" });
    const actor = await createUser({ firstName: "Elif", lastName: "Kaya" });

    await notify({
      userId: recipient.id,
      actorId: actor.id,
      type: "FOLLOW",
      data: { source: "profil" },
    });

    const rows = await db.notification.findMany({ where: { userId: recipient.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe("FOLLOW");
    expect(rows[0]?.actorId).toBe(actor.id);
    expect(JSON.parse(rows[0]?.dataJson ?? "{}")).toEqual({ source: "profil" });
  });

  it("notifyMany kendini, tekrarları ve engellenmiş kullanıcıları eler", async () => {
    const actor = await createUser({ firstName: "Elif", lastName: "Kaya" });
    const r1 = await createUser({ firstName: "Ali", lastName: "Yılmaz" });
    const r2 = await createUser({ firstName: "Zeynep", lastName: "Aksoy" });
    const blocked = await createUser({ firstName: "Can", lastName: "Demir" });
    await db.block.create({ data: { blockerId: blocked.id, blockedId: actor.id } });

    await notifyMany([actor.id, r1.id, r1.id, r2.id, blocked.id], {
      actorId: actor.id,
      type: "NEW_PROJECT_FROM_FOLLOWING",
    });

    expect(await db.notification.count({ where: { userId: actor.id } })).toBe(0);
    expect(await db.notification.count({ where: { userId: blocked.id } })).toBe(0);
    expect(await db.notification.count({ where: { userId: r1.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: r2.id } })).toBe(1);
  });
});
