import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("renders production metadata, policy links and security headers", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(new Request("https://example.com/", { headers: { accept: "text/html" } }), env, ctx);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=31536000/);
  const html = await response.text();
  assert.doesNotMatch(html, /codex-preview/i);
  assert.match(html, /rel="canonical"/i);
  assert.match(html, /\/methodology/);
  assert.match(html, /\/data-policy/);
  assert.match(html, /\/corrections/);
  assert.match(html, /146(?:<!-- -->)? provisional event clusters/i);
});

test("public information routes render", async () => {
  const worker = await loadWorker();
  for (const path of ["/methodology", "/data-policy", "/corrections", "/robots.txt", "/sitemap.xml"]) {
    const response = await worker.fetch(new Request(`https://example.com${path}`, { headers: { accept: "text/html" } }), env, ctx);
    assert.equal(response.status, 200, path);
  }
});
