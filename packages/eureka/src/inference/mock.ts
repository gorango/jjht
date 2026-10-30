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
      const { researcher, company, challenge, score, industrialContact } = input;
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
      const publication = (researcher.publicationsDetailed as Array<{ id: string; title: string }>)[0];
      const titleLine = publication
        ? `${researcher.name}'s paper "${publication.title}" (${publication.id}) is the closest published work.`
        : `${researcher.name}'s published record is the closest work.`;
      const industrial = industrialContact
        ? `${industrialContact.name} (${industrialContact.role}, ${company.name})`
        : `the Head of Engineering at ${company.name}`;
      const markdown = [
        `# ${company.name} × ${researcher.name}`,
        "",
        `**Challenge:** ${challenge.text}`,
        "",
        `## The problem`,
        `${challenge.text.replace(/^We need to /i, "").replace(/\.$/, "")}.`,
        "",
        `## Research questions`,
        "1. Which part of the stated problem can be solved with the methods the faculty already uses?",
        "2. What measurement would convince the company that the result works on its own line?",
        "3. What would make the approach fail badly enough to stop after year one?",
        "",
        `## Plan`,
        "| Year | Work | Result |",
        "| --- | --- | --- |",
        "| 1 | A baseline built on 2,000 labelled samples from the company's existing process | A working baseline and a dataset paper |",
        "| 2 | Extend the method to the second operating condition and measure it on site | A journal paper and a prototype |",
        "| 3 | A full trial through one operating cycle, compared with the current process | The thesis and a rollout decision |",
        "",
        `## What each side brings`,
        `- **Company:** ${company.rd_capacity} and access to the operating data.`,
        `- **Faculty:** supervision by ${researcher.name}, laboratory time, and ${researcher.keywords.slice(0, 3).join(", ")}.`,
        "",
        `## Why this pair`,
        `${score.why} ${titleLine}`,
        "",
        `## Agreed up front`,
        "- Results may be published after a 60-day review by the company.",
        "- The company owns the rig and the trained models; the faculty keeps the methods.",
        "",
        `## Risks`,
        `The pair fails if the company cannot commit timely access to its operating data. ${score.risks.join("; ") || ""}`.trim(),
        "",
        `## Unverified evidence`,
        "- Budget, data-access terms and the candidate's availability are not in the dataset and remain to be confirmed.",
        "",
        `## Supervisors and candidate`,
        `- **Academic supervisor:** ${researcher.name} (${researcher.title}, ${researcher.department}).`,
        `- **Industrial supervisor:** ${industrial}.`,
        `- **Candidate:** a master's graduate in ${researcher.fields[0] ?? company.sector}, employed by ${company.name} for the three years.`,
        "",
        `## References`,
        ...citations.map((id) => `- ${id}`),
      ].join("\n");

      return {
        title: `${company.name} × ${researcher.name}: ${researcher.fields[0] ?? company.sector}`,
        supervisors: {
          academic: `${researcher.name} (${researcher.title}, ${researcher.department})`,
          industrial,
        },
        candidate: `a master's graduate in ${researcher.fields[0] ?? company.sector}, employed by ${company.name} for the three years`,
        researchQuestions: [
          "Which part of the stated problem can be solved with the methods the faculty already uses?",
          "What measurement would convince the company that the result works on its own line?",
          "What would make the approach fail badly enough to stop after year one?",
        ],
        plan: [
          { year: 1, work: "A baseline built on 2,000 labelled samples from the company's existing process", result: "A working baseline and a dataset paper" },
          { year: 2, work: "Extend the method to the second operating condition and measure it on site", result: "A journal paper and a prototype" },
          { year: 3, work: "A full trial through one operating cycle, compared with the current process", result: "The thesis and a rollout decision" },
        ],
        whatEachSideBrings: {
          company: [`${company.rd_capacity} and access to the operating data.`],
          faculty: [`Supervision by ${researcher.name}, laboratory time, and ${researcher.keywords.slice(0, 3).join(", ")}.`],
        },
        whyThisPair: `${score.why} ${titleLine}`,
        agreedUpFront: {
          publicationReviewDays: 60,
          ip: "The company owns the rig and the trained models; the faculty keeps the methods.",
        },
        risks: [`The pair fails if the company cannot commit timely access to its operating data.`],
        unverified: ["Budget, data-access terms and the candidate's availability are not in the dataset and remain to be confirmed."],
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
