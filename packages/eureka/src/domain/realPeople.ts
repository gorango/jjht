/**
 * A hard guard against sending a real person's identifier to a model.
 *
 * The synthetic dataset has no ORCID or OpenAlex ids. If a host injects one,
 * the run refuses the turn unless the operator passes `--allow-real-people`:
 * matching a fictional researcher is not a licence to profile a real one.
 */
const REAL_ID_KEYS = /^(orcid|orcid_?id|openalex|openalex_?id|author_?id)$/i;
const ORCID = /\b\d{4}-\d{4}-\d{4}-[\dX]{4}\b/i;
const ORCID_URL = /orcid\.org\/\d{4}-\d{4}-\d{4}-[\dX]{4}/i;
const OPENALEX_URL = /openalex\.org\/[AW]\d+/i;

export const realPeopleGuard = (value: unknown): string | undefined => {
  const seen = new Set<unknown>();
  const visit = (node: unknown, path: string): string | undefined => {
    if (node === null || node === undefined) return undefined;
    if (typeof node === "string") {
      if (ORCID.test(node) || ORCID_URL.test(node) || OPENALEX_URL.test(node)) {
        return `real-person identifier at ${path}`;
      }
      return undefined;
    }
    if (typeof node !== "object") return undefined;
    if (seen.has(node)) return undefined;
    seen.add(node);
    if (Array.isArray(node)) {
      for (let index = 0; index < node.length; index += 1) {
        const found = visit(node[index], `${path}[${index}]`);
        if (found) return found;
      }
      return undefined;
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (REAL_ID_KEYS.test(key)) return `real-person field "${key}" at ${path}`;
      const found = visit(child, `${path}.${key}`);
      if (found) return found;
    }
    return undefined;
  };
  return visit(value, "payload");
};
