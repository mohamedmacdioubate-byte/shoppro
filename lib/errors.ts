/**
 * Les erreurs de validation Zod (.flatten()) renvoient un objet
 * { formErrors: string[], fieldErrors: { [champ]: string[] } }, pas une
 * simple chaîne. Afficher cet objet directement dans du JSX fait planter
 * React ("Objects are not valid as a React child"). Cette fonction extrait
 * toujours un texte affichable, quelle que soit la forme de l'erreur reçue.
 */
export function extractErrorMessage(data: unknown, fallback = "Une erreur est survenue"): string {
  if (!data) return fallback;
  if (typeof data === "string") return data;

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;

    // forme Zod .flatten() : { formErrors, fieldErrors }
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
