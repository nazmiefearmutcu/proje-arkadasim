import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "./helpers/db";

const mocks = vi.hoisted(() => ({ viewer: null as unknown }));

vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () => mocks.viewer,
}));

import { GET } from "../src/app/(app)/bildirimler/git/[id]/route";

function call(id: string) {
  const request = new Request(`http://localhost/bildirimler/git/${id}`);
  return GET(request, { params: Promise.resolve({ id }) });
}

describe("GET /bildirimler/git/[id]", () => {
  beforeEach(async () => {
    await resetDb();
    mocks.viewer = null;
  });

  it("marks the viewer's own notification read and redirects to its target", async () => {
    const viewer = await createUser();
    const actor = await createUser({ username: "takipci" });
    const notification = await db.notification.create({
      data: { userId: viewer.id, type: "FOLLOW", actorId: actor.id, dataJson: "{}" },
    });
    mocks.viewer = viewer;

    const response = await call(notification.id);

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/u/takipci");
    const after = await db.notification.findUnique({ where: { id: notification.id } });
    expect(after?.readAt).not.toBeNull();
  });

  it("keeps the original read time of an already read notification", async () => {
    const viewer = await createUser();
    const readAt = new Date("2026-01-02T10:00:00Z");
    const notification = await db.notification.create({
      data: { userId: viewer.id, type: "VERIFICATION_RESULT", dataJson: JSON.stringify({ status: "APPROVED" }), readAt },
    });
    mocks.viewer = viewer;

    const response = await call(notification.id);

    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/dogrulama");
    const after = await db.notification.findUnique({ where: { id: notification.id } });
    expect(after?.readAt?.getTime()).toBe(readAt.getTime());
  });

  it("redirects to /bildirimler without changes for someone else's notification", async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const notification = await db.notification.create({
      data: { userId: owner.id, type: "VERIFICATION_RESULT", dataJson: JSON.stringify({ status: "APPROVED" }) },
    });
    mocks.viewer = viewer;

    const response = await call(notification.id);

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/bildirimler");
    const after = await db.notification.findUnique({ where: { id: notification.id } });
    expect(after?.readAt).toBeNull();
  });

  it("redirects a missing notification to /bildirimler", async () => {
    mocks.viewer = await createUser();
    const response = await call("olmayan-bildirim");
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/bildirimler");
  });

  it("sends a guest to sign in and keeps the return path", async () => {
    const owner = await createUser();
    const notification = await db.notification.create({
      data: { userId: owner.id, type: "VERIFICATION_RESULT", dataJson: "{}" },
    });
    mocks.viewer = null;

    const response = await call(notification.id);

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/giris");
    expect(location.searchParams.get("next")).toBe(`/bildirimler/git/${notification.id}`);
  });
});
