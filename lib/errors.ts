export function extractErrorMessage(data: unknown, fallback = "Une erreur est survenue"): string {
  if (!data) return fallback;
  if (typeof data === "string") return data;

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;

    if (Array.isArray(obj.formErrors) && obj.formErrors.length > 0) {
      return String(obj.formErrors[0]);
    }
    if (obj.fieldErrors && typeof obj.fieldErrors === "object") {
      const firstFieldErrors = Object.values(obj.fieldErrors as Record<string, unknown>).find(
        (v) => Array.isArray(v) && v.length > 0
      ) as string[] | undefined;
      if (firstFieldErrors) return firstFieldErrors[0];
    }
  }

  return fallback;
}
