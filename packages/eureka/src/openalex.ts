/**
 * OpenAlex enrichment probe.
 *
 * Not part of the pipeline: the run is complete on the synthetic dataset alone.
 * This exists so a team can (a) prove their key works and (b) pull real
 * University of Novi Sad context for a proposal's "why this pair" section,
 * without sending a real person's profile to a model.
 *
 *   bun run openalex
 */
const BASE = "https://api.openalex.org";
export const UNS_INSTITUTION = "I170726198"; // University of Novi Sad, ROR 00xa57a59

interface OpenAlexList<T> {
  meta: { count: number };
  results: T[];
}

const get = async <T>(path: string, key: string): Promise<T> => {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (body.error === "key_not_activated") {
      throw new Error(
        "OpenAlex key is pending activation — open the activation email and click the link, then retry.",
      );
    }
    throw new Error(`OpenAlex ${response.status}: ${body.message ?? body.error ?? response.statusText}`);
  }

  return (await response.json()) as T;
};

export const openalexProbe = async (): Promise<void> => {
  const key = process.env.OPENALEX_API_KEY;
  if (!key) {
    console.log("OPENALEX_API_KEY is not set — copy .env.example to .env first.");
    console.log("Free key: https://openalex.org/settings/api-key");
    return;
  }

  const institution = await get<{ display_name: string; works_count: number; cited_by_count: number; homepage_url: string }>(
    `/institutions/${UNS_INSTITUTION}`,
    key,
  );

  const authors = await get<OpenAlexList<{ display_name: string; works_count: number; id: string }>>(
    `/authors?filter=last_known_institutions.id:${UNS_INSTITUTION}&per-page=5&sort=cited_by_count:desc`,
    key,
  );

  console.log(
    [
      "",
      `  ${institution.display_name}`,
      `  works ${institution.works_count.toLocaleString("en-US")} · citations ${institution.cited_by_count.toLocaleString("en-US")}`,
      `  ${institution.homepage_url}`,
      "",
      `  top authors on record (${authors.meta.count.toLocaleString("en-US")} total):`,
      ...authors.results.map((author) => `    ${author.display_name} — ${author.works_count} works`),
      "",
      "  The pipeline does not need this data. Use it to ground a proposal in real, citable work",
      "  (and never to rank a real person by worth) — see docs/architecture.md.",
      "",
    ].join("\n"),
  );
};
