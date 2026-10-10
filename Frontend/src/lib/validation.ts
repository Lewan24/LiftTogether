export function safeProfileUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["facebook.com", "www.facebook.com"].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function validateProfile(input: {
  firstName: string;
  lastName: string;
  email: string;
  facebookUrl: string;
}) {
  if (
    ![input.firstName, input.lastName].every(
      (v) => v.trim().length > 0 && v.length <= 80,
    ) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
    input.email.length > 254 ||
    (input.facebookUrl && !safeProfileUrl(input.facebookUrl))
  )
    throw new Error("INVALID_PROFILE");
}
