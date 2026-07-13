import { describe, expect, it, vi } from "vitest";
import { buildDailyFeedPayload, safeReason, snapshotPayload } from "./dailyFeed";
import { normalizePublicHttpUrl, parsePublicIndex } from "../shared/public-index";
import fallbackReports from "../shared/data/indexed-reports.json";
import incidents from "../shared/data/incidents.json";

describe("daily-feed snapshot fallback", () => {
  it("falls back to the validated snapshot when the live source is unreachable", async () => {
    const failingFetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const payload = await buildDailyFeedPayload(failingFetch);
    expect(payload.overallStatus).toBe("degraded");
    expect(payload.sourceMode).toBe("validated-snapshot");
    expect(payload.degradedReason).toBe("source-unavailable");
    expect(payload.indexedReports.length).toBe((fallbackReports as unknown[]).length);
    expect(payload.pendingCandidateCount).toBeGreaterThan(0);
  });

  it("quarantines suspicious shrunken responses", async () => {
    const tinyBody = '<div class="elementor-element preview-box 2024 m03 residential uk"><a href="https://example.com/a" class="vlp-link"></a><div class="vlp-block-0 vlp-link-title">Solar panel fire at home</div><div class="vlp-block-1 vlp-link-summary">A rooftop solar fire was reported.</div></div>';
    const shrunkenFetch = (async () =>
      new Response(tinyBody, {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;

    const payload = await buildDailyFeedPayload(shrunkenFetch);
    expect(payload.overallStatus).toBe("degraded");
    expect(payload.degradedReason).toBe("source-shrink-quarantined");
    expect(payload.sourceMode).toBe("validated-snapshot");
  });

  it("rejects unexpected content types", async () => {
    const jsonFetch = (async () =>
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const payload = await buildDailyFeedPayload(jsonFetch);
    expect(payload.degradedReason).toBe("unexpected-content-type");
  });

  it("maps raw errors to safe public reasons", () => {
    expect(safeReason(new Error("payload-too-large"))).toBe("payload-too-large");
    expect(safeReason(new Error("markup-not-recognized"))).toBe("validation-failed");
    expect(safeReason(new Error("secret internal detail"))).toBe("source-unavailable");
  });

  it("snapshot payload carries pipeline timestamps and no live flag", () => {
    const payload = snapshotPayload("2026-07-13T00:00:00.000Z", "source-unavailable");
    expect(payload.contentDiffersFromSnapshot).toBe(false);
    expect(payload.lastValidatedSnapshotAt).toBeTruthy();
    expect(payload.indexedReports.length).toBeGreaterThan(100);
  });
});

describe("public index parser", () => {
  it("parses valid preview-box markup into normalized records", () => {
    const html = [
      '<div class="elementor-element preview-box 2025 m11 residential germany"><a href="https://www.example.de/brand?utm_source=x" class="vlp-link"></a><div class="vlp-block-0 vlp-link-title">Dachbrand durch Solarmodul</div><div class="vlp-block-1 vlp-link-summary">Ein Brand an einer Solaranlage wurde gemeldet.</div></div>',
      '<div class="elementor-element preview-box 2025 m10 utility spain"><a href="https://www.example.es/incendio" class="vlp-link"></a><div class="vlp-block-0 vlp-link-title">Incendio en planta solar</div><div class="vlp-block-1 vlp-link-summary">Fire at a photovoltaic plant reported by local media.</div></div>',
    ].join("\n");
    const records = parsePublicIndex(html, "2026-07-13");
    expect(records.length).toBe(2);
    expect(records[0]?.date >= records[1]?.date).toBe(true);
    expect(records.every((r) => r.status === "source-indexed")).toBe(true);
    expect(records.find((r) => r.country === "Germany")?.assetType).toBe("rooftop");
    expect(records.find((r) => r.country === "Spain")?.assetType).toBe("utility");
    // tracking params stripped
    expect(records.find((r) => r.country === "Germany")?.sourceUrl).not.toContain("utm_source");
  });

  it("excludes battery-only and guidance headlines", () => {
    const html = [
      '<div class="elementor-element preview-box 2025 m09 commercial uk"><a href="https://example.co.uk/bess" class="vlp-link"></a><div class="vlp-block-0 vlp-link-title">Battery storage blaze at depot</div><div class="vlp-block-1 vlp-link-summary">A BESS battery container caught fire.</div></div>',
      '<div class="elementor-element preview-box 2025 m09 residential uk"><a href="https://example.co.uk/guide" class="vlp-link"></a><div class="vlp-block-0 vlp-link-title">Solar fire safety guide for homeowners</div><div class="vlp-block-1 vlp-link-summary">How to reduce fire risk from panels.</div></div>',
    ].join("\n");
    const records = parsePublicIndex(html, "2026-07-13");
    expect(records.length).toBe(0);
  });

  it("throws on unrecognized markup", () => {
    expect(() => parsePublicIndex("<html><body>nothing here</body></html>", "2026-07-13")).toThrow(
      "markup-not-recognized",
    );
  });
});

describe("url normalization", () => {
  it("blocks private hosts and strips tracking params", () => {
    expect(normalizePublicHttpUrl("http://192.168.1.10/report")).toBe("");
    expect(normalizePublicHttpUrl("http://localhost/x")).toBe("");
    expect(normalizePublicHttpUrl("https://www.example.com/a?fbclid=123&x=1")).toBe("https://example.com/a?x=1");
  });
});

describe("data integrity", () => {
  it("reviewed incidents all carry coordinates, dates and countries", () => {
    for (const incident of incidents as Array<{ lat: number; lng: number; date: string; country: string }>) {
      expect(typeof incident.lat).toBe("number");
      expect(typeof incident.lng).toBe("number");
      expect(incident.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(incident.country.length).toBeGreaterThan(1);
    }
  });
});

describe("shared typed data module", () => {
  it("exports validated datasets without throwing", async () => {
    const data = await import("../shared/pvFireWatchData");
    expect(data.reviewedIncidents.length).toBeGreaterThan(10);
    expect(data.indexedReports.length).toBeGreaterThan(100);
    expect(data.pendingCandidateCount).toBeGreaterThanOrEqual(0);
    expect(data.eventGroups.recordToEvent).toBeTypeOf("object");
    expect(data.researchSources.some((s) => s.jurisdiction.includes("England"))).toBe(true);
  });
});

describe("scheduled daily-refresh handler", () => {
  it("rejects non-cron callers with 403", async () => {
    const { dailyRefreshHandler } = await import("./scheduledRefresh");
    const { sdk } = await import("./_core/sdk");
    const spy = vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({
      id: 1, openId: "u_real", name: "User", email: null, loginMethod: null,
      role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as never);
    let statusCode = 0;
    let body: unknown = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { body = payload; },
    };
    await dailyRefreshHandler({ originalUrl: "/api/scheduled/daily-refresh", headers: {} } as never, res as never);
    expect(statusCode).toBe(403);
    expect(body).toEqual({ error: "cron-only" });
    spy.mockRestore();
  });
});

describe("scheduled daily-refresh handler success path", () => {
  it("runs the daily check for cron callers and returns the summary payload", async () => {
    const { dailyRefreshHandler } = await import("./scheduledRefresh");
    const { sdk } = await import("./_core/sdk");
    const dailyFeed = await import("./dailyFeed");
    const fakePayload = {
      overallStatus: "healthy",
      lastAttemptAt: "2026-07-13T04:17:00.000Z",
      lastSuccessfulCheckAt: "2026-07-13T04:17:00.000Z",
      lastValidatedSnapshotAt: "2026-07-01T00:00:00.000Z",
      lastContentChangeAt: "2026-07-01T00:00:00.000Z",
      contentDiffersFromSnapshot: false,
      indexedReports: [{ id: "r1" }, { id: "r2" }],
      pendingCandidateCount: 0,
      sourceMode: "daily-live-check",
      degradedReason: null,
    };
    const authSpy = vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({
      id: -1, openId: "cron_abc", name: "Manus Scheduled Task", email: null,
      loginMethod: null, role: "user", createdAt: new Date(), updatedAt: new Date(),
      lastSignedIn: new Date(), isCron: true, taskUid: "task-123",
    } as never);
    const runSpy = vi.spyOn(dailyFeed, "runDailyCheck").mockResolvedValue(fakePayload as never);
    let statusCode = 200;
    let body: Record<string, unknown> = {};
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: Record<string, unknown>) { body = payload; },
    };
    await dailyRefreshHandler({ originalUrl: "/api/scheduled/daily-refresh", headers: {} } as never, res as never);
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(statusCode).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      overallStatus: "healthy",
      sourceMode: "daily-live-check",
      reportCount: 2,
      checkedAt: "2026-07-13T04:17:00.000Z",
    });
    authSpy.mockRestore();
    runSpy.mockRestore();
  });
});
