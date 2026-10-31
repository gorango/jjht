import { describe, expect, test } from "bun:test";

import {
  buildBaroArgs,
  modelsFrom,
  parseEnv,
  redactedCommand,
  type BaroOptions,
} from "../scripts/baro-handoff.js";

const base: BaroOptions = {
  backend: "openai",
  scratch: "/repo/modules/custodian-scratch",
  goal: "/repo/packages/custodian/outbox/inc-1/goal.txt",
  localOnly: true,
  detach: false,
  effort: "high",
  timeout: 900,
  models: modelsFrom({}),
  extra: [],
};

describe("the baro handoff", () => {
  test("parses .env without touching comments or quoted values", () => {
    const env = parseEnv(`
# a comment
OPENCODE_GO_BASE_URL=https://opencode.ai/inference/go/openai/v1
OPENCODE_GO_API_KEY="abc=def"
BARO_TIMEOUT=900
`);
    expect(env.OPENCODE_GO_BASE_URL).toBe("https://opencode.ai/inference/go/openai/v1");
    expect(env.OPENCODE_GO_API_KEY).toBe("abc=def");
    expect(env.BARO_TIMEOUT).toBe("900");
  });

  test("routes pro to the work that writes code and flash to cheap judgment", () => {
    const models = modelsFrom({});
    expect(models.story).toBe("deepseek-v4-pro");
    expect(models.architect).toBe("deepseek-v4-pro");
    expect(models.surgeon).toBe("deepseek-v4-pro");
    expect(models.planner).toBe("deepseek-v4.1-flash");
    expect(models.critic).toBe("deepseek-v4.1-flash");
    expect(models.dialogue).toBe("deepseek-v4.1-flash");
    expect(modelsFrom({ BARO_STORY_MODEL: "deepseek-v4.1-flash" }).story).toBe(
      "deepseek-v4.1-flash",
    );
  });

  test("direct mode uses bare model ids and local-only by default", () => {
    const args = buildBaroArgs(base);
    expect(args.slice(0, 3)).toEqual(["--llm", "openai", "--headless"]);
    expect(args).toContain("--local-only");
    expect(args).not.toContain("--detach");
    expect(args[args.indexOf("--story-model") + 1]).toBe("deepseek-v4-pro");
    expect(args[args.indexOf("--critic-model") + 1]).toBe("deepseek-v4.1-flash");
  });

  test("opencode mode prefixes provider ids and allows detach", () => {
    const args = buildBaroArgs({
      ...base,
      backend: "opencode",
      localOnly: false,
      detach: true,
    });
    expect(args.slice(0, 2)).toEqual(["--llm", "opencode"]);
    expect(args).toContain("--detach");
    expect(args).not.toContain("--local-only");
    expect(args[args.indexOf("--story-model") + 1]).toBe("opencode-go/deepseek-v4-pro");
  });

  test("redacts a key if one ever reaches the argv", () => {
    expect(redactedCommand("baro", ["--api-key", "secret"])).toBe("baro --api-key <redacted>");
  });
});
