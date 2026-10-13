import assert from "node:assert/strict";
import { test } from "node:test";

test("HTTP contracts validate without probing or compiling JavaScript under strict CSP", async () => {
  const OriginalFunction = globalThis.Function;
  let attempts = 0;
  globalThis.Function = new Proxy(OriginalFunction, {
    construct() {
      attempts++;
      throw new EvalError("Blocked by CSP");
    },
    apply() {
      attempts++;
      throw new EvalError("Blocked by CSP");
    },
  });
  try {
    const { auditPageSchema } = await import("../src/services/contracts.ts");
    assert.deepEqual(
      auditPageSchema.parse({ entries: [], page: 0, hasMore: false }),
      { entries: [], page: 0, hasMore: false },
    );
    assert.equal(
      auditPageSchema.safeParse({
        entries: [],
        page: "invalid",
        hasMore: false,
      }).success,
      false,
    );
    assert.equal(attempts, 0);
  } finally {
    globalThis.Function = OriginalFunction;
  }
});
