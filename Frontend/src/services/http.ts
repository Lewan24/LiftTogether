export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
export type Decoder<T> = (value: unknown) => T;
export function createHttpClient(
  base = "/api/",
  csrfToken: () => string | null = () => null,
) {
  const root = new URL(base, window.location.origin);
  if (
    root.origin !== window.location.origin ||
    root.search ||
    root.hash ||
    root.username ||
    root.password
  )
    throw new Error("API must use a same-origin URL");
  if (!root.pathname.endsWith("/")) root.pathname += "/";
  return async function request<T>(
    path: string,
    decode: Decoder<T>,
    options: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      body?: unknown;
      signal?: AbortSignal;
      query?: Record<string, string | number>;
    } = {},
  ): Promise<T> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(path))
      throw new Error("Invalid API path");
    const url = new URL(path, root);
    for (const [key, value] of Object.entries(options.query ?? {}))
      url.searchParams.set(key, String(value));
    if (!url.pathname.startsWith(root.pathname))
      throw new Error("Invalid API path");
    const method = options.method ?? "GET";
    const headers: Record<string, string> = { Accept: "application/json" };
    const form = options.body instanceof FormData;
    if (options.body !== undefined && !form)
      headers["Content-Type"] = "application/json";
    if (method !== "GET") {
      const token = csrfToken();
      if (!token) throw new ApiError(0, "CSRF_TOKEN_REQUIRED");
      headers["X-CSRF-Token"] = token;
    }
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body:
          options.body === undefined
            ? undefined
            : form
              ? (options.body as FormData)
              : JSON.stringify(options.body),
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        let code =
          response.status === 401
            ? "UNAUTHENTICATED"
            : response.status === 403
              ? "FORBIDDEN"
              : response.status === 429
                ? "RATE_LIMITED"
                : "REQUEST_FAILED";
        try {
          const problem = await response.json();
          if (
            typeof problem.code === "string" &&
            /^[A-Z_]{1,80}$/.test(problem.code)
          )
            code = problem.code;
        } catch {
          /* Non-JSON proxy errors. */
        }
        if (response.status === 401 && !path.startsWith("auth/"))
          window.dispatchEvent(new Event("session-expired"));
        throw new ApiError(response.status, code);
      }
      if (response.status === 204) return decode(null);
      if (!response.headers.get("content-type")?.includes("application/json"))
        throw new ApiError(response.status, "INVALID_RESPONSE");
      return decode(await response.json());
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  };
}
