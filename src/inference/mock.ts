/**
 * A deterministic stand-in model.
 *
 * It exists so the whole pipeline — concurrency, claims, the Critic's rejection
 * loop, the trace — can be run and tested with no API key, no network and no
 * cost. It is not a mock of the runtime: every participant, event and lease is
 * the real thing. Only the text generation is canned, and the trace labels the
 * model as `mock`.
 *
 * Run it with MOCK=1.
 */
import { ModelMessageItem, TokenUsage, InputTokenDetails, OutputTokenDetails, type InferenceInput, type InferenceOutput, type InferenceRunner, type SemanticEvent } from "@mozaik-ai/core";

interface TaskEnvelope {
  role: "profiler" | "analyst" | "matchmaker" | "writer" | "critic";
  item: string;
  attempt: number;
  input: any;
}

const estimateTokens = (text: string): number => Math.max(1, Math.ceil(text.length / 4));

const firstSentence = (text: string): string => {
  const match = /^(.{40,220}?[.!?])\s/.exec(text);
  return match?.[1] ?? text.slice(0, 200);
};

const readTask = (request: InferenceInput): TaskEnvelope => {
  const items = request.context.getItems();
  const user = items.find((item) => (item as any).role === "user");
  const text = (user as any)?.content?.text ?? "{}";
  return JSON.parse(text) as TaskEnvelope;
};

const respond = (task: TaskEnvelope): unknown => {
  const { input } = task;

  switch (task.role) {
    case "profiler": {
      const r = input.researcher;
      return {
        summary: firstSentence(r.bio),
        expertise: r.fields,
        openTo: r.open_to.slice(0, 3),
        industrySignals: r.industry_experience ? [firstSentence(r.industry_experience)] : [],
        citations: [r.id, ...r.publications.slice(0, 2)],
      };
    }

    case "analyst": {
      const c = input.challenge;
      return {
        problem: c.text,
        needs: input.keywords.slice(0, 5),
        keywords: input.keywords.slice(0, 10),
      };
    }

    case "matchmaker": {
      const ranked = (input.candidates as Array<{ researcherId: string; score: number; sharedTerms: string[] }>).map(
        (candidate, index) => ({
          researcherId: candidate.researcherId,
          fit: Math.max(0.2, Math.min(0.98, 0.92 - index * 0.08)),
          why: `Shared ground with the company: ${candidate.sharedTerms.slice(0, 4).join(", ")}.`,
          sharedTerms: candidate.sharedTerms,
          risks: index === 0 ? [] : ["weaker overlap with the stated challenge"],
        }),
      );
      return { ranked };
    }

    case "writer": {
      const { researcher, company, challenge, score } = input;
      const real = [
        challenge.id,
        researcher.id,
        ...(researcher.publications as string[]).slice(0, 2),
        ...(researcher.projects as string[]).slice(0, 1),
      ];
      // Deliberately hallucinate on the first pass so the Critic has something to
      // catch. This is the failure mode the EINSTEIN brief is built around.
      const fabricated = task.attempt === 0 ? ["SYN-PUB-99999"] : [];
      const citations = [...real, ...fabricated];
      const markdown = [
        `# ${company.name} × ${researcher.name}`,
        "",
        `**Challenge:** ${challenge.text}`,
        "",
        `## Why this pair`,
        `${score.why} ${researcher.name} works on ${researcher.fields.slice(0, 2).join(" and ")}, and the company's ` +
          `${company.sector.toLowerCase()} roadmap needs exactly that.`,
        "",
        `## What we would do together`,
        `A 12-month joint project: ${challenge.text.replace(/^We need to /i, "").replace(/\.$/, "")}. ` +
          `The company brings ${company.rd_capacity.toLowerCase()} The faculty brings ${researcher.keywords.slice(0, 3).join(", ")}.`,
        "",
        `## Industrial PhD option`,
        `If the results hold, the work becomes an industrial PhD topic supervised by ${researcher.name} ` +
          `(${researcher.department}) and an engineer from ${company.name}.`,
        "",
        `## Risks`,
        `The pairing depends on data access the company has not yet committed. ${score.risks.join("; ") || "No structural risk identified."}`,
        "",
        `## References`,
        ...citations.map((id) => `- ${id}`),
      ].join("\n");

      return {
        title: `${company.name} × ${researcher.name}: ${researcher.fields[0] ?? company.sector}`,
        markdown,
        citations,
        claims: [
          { text: `The company's stated challenge is ${challenge.id}.`, sources: [challenge.id] },
          { text: `${researcher.name} works in ${researcher.fields.slice(0, 2).join(" and ")}.`, sources: [researcher.id] },
          ...real
            .filter((id) => !id.startsWith("SYN-PUB-99999"))
            .slice(2, 4)
            .map((id) => ({ text: `Result ${id} is part of the researcher's record.`, sources: [id] })),
        ],
      };
    }

    case "critic": {
      const known: string[] = input.allowedSources;
      const cited: string[] = input.citations;
      const unknown = cited.filter((id) => !known.includes(id));
      const claims = input.claims as Array<{ text: string; sources: string[] }>;

      return {
        verdict: unknown.length > 0 ? "reject" : "approve",
        note:
          unknown.length > 0
            ? `Unsupported source(s): ${unknown.join(", ")}. Replace or remove before resubmission.`
            : `All ${cited.length} sources resolve in the dataset.`,
        claims: claims.map((claim) => ({
          ...claim,
          sources: claim.sources.filter((id) => known.includes(id)),
        })),
      };
    }

    default:
      return {};
  }
};

export class MockRunner implements InferenceRunner {
  async run(request: InferenceInput): Promise<InferenceOutput> {
    const task = readTask(request);
    const answer = JSON.stringify(respond(task), null, 2);
    const inputTokens = estimateTokens(JSON.stringify(request.context.getItems()));
    const outputTokens = estimateTokens(answer);

    return {
      items: [ModelMessageItem.rehydrate({ text: answer })],
      tokenUsage: new TokenUsage(inputTokens, outputTokens, inputTokens + outputTokens, new InputTokenDetails(0), new OutputTokenDetails(0)),
      rowResponse: { model: "mock", task: task.role },
    };
  }

  async *stream(): AsyncGenerator<SemanticEvent> {
    // Not used: the pipeline runs non-streaming so a turn is one atomic result.
  }
}
