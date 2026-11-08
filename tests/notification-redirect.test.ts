import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "./helpers/db";

const mocks = vi.hoisted(() => ({ viewer: null as unknown }));

vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () => mocks.viewer,
}));

import { GET } from "../src/app/(app)/bildirimler/git/[id]/route";

// Kendi sunucusunda request.url iç adrestir (http://localhost:<port>). Yönlendirme ondan kurulmamalı:
// Location göreli olmalı ve tarayıcı onu kullanıcının açtığı adrese göre çözmeli.
const INTERNAL_ORIGIN = "http://localhost:3000";
const PUBLIC_ORIGIN = "http://192.168.1.20:3000";

function call(id: string, headers: Record<string, string> = {}) {
  const request = new Request(`${INTERNAL_ORIGIN}/bildirimler/git/${id}`, { headers });
  return GET(request, { params: Promise.resolve({ id }) });
}

/** Location başlığını tarayıcının yaptığı gibi, sayfanın açık adresine göre çözer. */
function locationOf(response: Response): URL {
  return new URL(response.headers.get("location") ?? "", PUBLIC_ORIGIN);
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
    expect(locationOf(response).pathname).toBe("/u/takipci");
    const after = await db.notification.findUnique({ where: { id: notification.id } });
    expect(after?.readAt).not.toBeNull();
  });

  it("sends a relative Location so the redirect stays on the public origin", async () => {
    const viewer = await createUser();
    const actor = await createUser({ username: "takipci" });
    const notification = await db.notification.create({
      data: { userId: viewer.id, type: "FOLLOW", actorId: actor.id, dataJson: "{}" },
    });
    mocks.viewer = viewer;

    const response = await call(notification.id);

    expect(response.headers.get("location")).toBe("/u/takipci");
    expect(locationOf(response).origin).toBe(PUBLIC_ORIGIN);
  });

  it.each([
    ["Next-Router-Prefetch", "1"],
    ["Sec-Purpose", "prefetch"],
    ["Purpose", "prefetch"],
    ["Sec-Purpose", "prefetch;prerender"],
  ])("answers a prefetch (%s: %s) with 204 and leaves the notification unread", async (name, value) => {
    const viewer = await createUser();
    const actor = await createUser();
    const notification = await db.notification.create({
      data: { userId: viewer.id, type: "FOLLOW", actorId: actor.id, dataJson: "{}" },
    });
    mocks.viewer = viewer;

    const response = await call(notification.id, { [name]: value });

    expect(response.status).toBe(204);
    expect(response.headers.get("location")).toBeNull();
    const after = await db.notification.findUnique({ where: { id: notification.id } });
    expect(after?.readAt).toBeNull();
  });

  it("still marks read on a normal client navigation request (RSC header, no prefetch header)", async () => {
    const viewer = await createUser();
    const notification = await db.notification.create({
      data: { userId: viewer.id, type: "VERIFICATION_RESULT", dataJson: JSON.stringify({ status: "APPROVED" }) },
    });
    mocks.viewer = viewer;

    const response = await call(notification.id, { RSC: "1" });

    expect(response.status).toBe(303);
    expect(locationOf(response).pathname).toBe("/dogrulama");
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

    expect(locationOf(response).pathname).toBe("/dogrulama");
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
    expect(locationOf(response).pathname).toBe("/bildirimler");
    const after = await db.notification.findUnique({ where: { id: notification.id } });
    expect(after?.readAt).toBeNull();
  });

  it("redirects a missing notification to /bildirimler", async () => {
    mocks.viewer = await createUser();
    const response = await call("olmayan-bildirim");
    expect(locationOf(response).pathname).toBe("/bildirimler");
  });

  it("sends a guest to sign in and keeps the return path", async () => {
    const owner = await createUser();
    const notification = await db.notification.create({
      data: { userId: owner.id, type: "VERIFICATION_RESULT", dataJson: "{}" },
    });
    mocks.viewer = null;

    const response = await call(notification.id);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")?.startsWith("/giris?")).toBe(true);
    const location = locationOf(response);
    expect(location.pathname).toBe("/giris");
    expect(location.searchParams.get("next")).toBe(`/bildirimler/git/${notification.id}`);
  });
});
