import { test } from "node:test";
import assert from "node:assert/strict";
import { createHttpClient, ApiError } from "../src/services/http.ts";
const host = new EventTarget();
Object.assign(globalThis, {
  window: {
    location: { origin: "https://gym.example.com" },
    dispatchEvent: host.dispatchEvent.bind(host),
  },
});
test("HTTP refuses cross-origin APIs and mutation without CSRF", async () => {
  assert.throws(() => createHttpClient("https://other.example.com/api"));
  const request = createHttpClient();
  await assert.rejects(
    request("bookings", (v) => v, { method: "POST", body: {} }),
    (e: unknown) => e instanceof ApiError && e.code === "CSRF_TOKEN_REQUIRED",
  );
  await assert.rejects(request("../admin", (v) => v));
});
test("HTTP sends cookies, CSRF and JSON, supports safe query parameters", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(
        String(input),
        "https://gym.example.com/api/bookings?page=2",
      );
      assert.equal(init?.credentials, "same-origin");
      assert.equal(
        (init?.headers as Record<string, string>)["X-CSRF-Token"],
        "token",
      );
      assert.equal(init?.body, '{"start":"07:00"}');
      return Response.json({ id: 1 });
    };
    assert.deepEqual(
      await createHttpClient("/api", () => "token")("bookings", (v) => v, {
        method: "POST",
        query: { page: 2 },
        body: { start: "07:00" },
      }),
      { id: 1 },
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("HTTP preserves API errors and validates response format", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({ code: "DAILY_CAPACITY_FULL" }, { status: 409 });
    await assert.rejects(
      createHttpClient()("bookings", (v) => v),
      (e: unknown) =>
        e instanceof ApiError &&
        e.status === 409 &&
        e.code === "DAILY_CAPACITY_FULL",
    );
    globalThis.fetch = async () =>
      new Response("<html>proxy error</html>", {
        headers: { "Content-Type": "text/html" },
      });
    await assert.rejects(
      createHttpClient()("bookings", (v) => v),
      (e: unknown) => e instanceof ApiError && e.code === "INVALID_RESPONSE",
    );
  } finally {
    globalThis.fetch = original;
  }
});
