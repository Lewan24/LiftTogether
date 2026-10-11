import { useState } from "react";

export default function DemoNotice() {
  const [error, setError] = useState("");
  if (import.meta.env.VITE_API_MODE !== "mock") return null;
  async function reset() {
    try {
      const { resetDemo } = await import("../services/mock");
      await resetDemo();
      window.location.hash = "";
      window.location.reload();
    } catch {
      setError(
        "Browser storage is unavailable. / Pamięć przeglądarki jest niedostępna.",
      );
    }
  }
  return (
    <aside
      className="border-b border-[var(--line)] bg-[var(--lime)] px-4 py-2 text-center text-sm text-[var(--ink)]"
      aria-label="Demo"
    >
      <p>
        Demo · Dane tylko w tej przeglądarce / Data stays in this browser. Use
        fictional details.
      </p>
      <button
        type="button"
        className="mt-1 cursor-pointer font-semibold underline"
        onClick={() => void reset()}
      >
        Reset demo / Zresetuj demo
      </button>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
