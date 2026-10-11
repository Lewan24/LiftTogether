export const apiMode = import.meta.env?.VITE_API_MODE ?? "http";
if (apiMode !== "http" && apiMode !== "mock")
  throw new Error("VITE_API_MODE must be http or mock");
export const isDemoMode = apiMode === "mock";
