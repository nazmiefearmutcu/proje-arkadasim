import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ortam "node": tarayıcının yalnız kullanılan parçaları (document görünürlüğü, fetch) taklit edilir.
type Visibility = "visible" | "hidden";

interface FakeDocument {
  visibilityState: Visibility;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

function fakeDocument() {
  const handlers = new Set<() => void>();
  const doc: FakeDocument = {
    visibilityState: "visible",
    addEventListener: (type, listener) => {
      if (type === "visibilitychange") handlers.add(listener);
    },
    removeEventListener: (type, listener) => {
      if (type === "visibilitychange") handlers.delete(listener);
    },
  };
  return {
    doc,
    listenerCount: () => handlers.size,
    setVisibility(state: Visibility) {
      doc.visibilityState = state;
      for (const handler of handlers) handler();
    },
  };
}

function countersResponse() {
  return {
    ok: true,
    json: async () => ({ authenticated: true, notifications: 1, messages: 2, requests: 0, invites: 0 }),
  };
}

type Module = typeof import("./use-counters");

let mod: Module;
let page: ReturnType<typeof fakeDocument>;
let fetchMock: ReturnType<typeof vi.fn>;

async function flush(): Promise<void> {
  // fetch → json → finally zincirinin bitmesi için birkaç mikro görev turu.
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe("useCounters ortak yoklayıcısı", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    page = fakeDocument();
    fetchMock = vi.fn(async () => countersResponse());
    vi.stubGlobal("document", page.doc);
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    mod = await import("./use-counters");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("iki abone olsa da her 20 sn'de tek istek atar ve tek dinleyici kurar", async () => {
    const releaseBell = mod.acquireCountersPoller();
    const releaseNav = mod.acquireCountersPoller();
    expect(page.listenerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(mod.POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(mod.POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    releaseBell();
    releaseNav();
  });

  it("sekme gizliyken istek atmaz; görünür olunca bir kez yeniler", async () => {
    const release = mod.acquireCountersPoller();
    page.setVisibility("hidden");

    await vi.advanceTimersByTimeAsync(mod.POLL_INTERVAL_MS * 3);
    expect(fetchMock).not.toHaveBeenCalled();

    page.setVisibility("visible");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release();
  });

  it("son abone gidince zamanlayıcıyı ve dinleyiciyi kaldırır; bir abone kalırken sürdürür", async () => {
    const first = mod.acquireCountersPoller();
    const second = mod.acquireCountersPoller();

    first();
    // Aynı bırakma fonksiyonunu iki kez çağırmak sayacı bozmaz.
    first();
    await vi.advanceTimersByTimeAsync(mod.POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.listenerCount()).toBe(1);

    second();
    expect(page.listenerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(mod.POLL_INTERVAL_MS * 3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshCounters hemen yeniler; abone yoksa hiçbir şey yapmaz", async () => {
    mod.refreshCounters();
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();

    const release = mod.acquireCountersPoller();
    mod.refreshCounters();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release();
  });

  it("istek sürerken gelen yenileme kaybolmaz: süren istek bitince bir kez daha çeker", async () => {
    let resolveFirst: (value: ReturnType<typeof countersResponse>) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const release = mod.acquireCountersPoller();

    await vi.advanceTimersByTimeAsync(mod.POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    mod.refreshCounters();
    mod.refreshCounters();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFirst(countersResponse());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    release();
  });
});
