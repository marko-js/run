import assert from "assert";

import appendAgentFixGuide, {
  agentRouteFixGuide,
} from "../utils/agent-fix-guide";

const AGENT_ENV_VARS = [
  "CLAUDECODE",
  "CLAUDE_CODE",
  "CURSOR_AGENT",
  "GEMINI_CLI",
  "CODEX_SANDBOX",
  "CODEX_THREAD_ID",
  "AI_AGENT",
];

describe("agent-fix-guide", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    // Neutralize whatever the ambient terminal set so the "human" case is
    // deterministic even when the suite runs inside a coding agent.
    saved = {};
    for (const key of AGENT_ENV_VARS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of AGENT_ENV_VARS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it("points a coding agent at the cheat sheet on compile errors", () => {
    process.env.CLAUDECODE = "1";
    const error = appendAgentFixGuide(new Error("Route conflict"));
    assert.match(
      error.message,
      /^Route conflict\n\nFix guide: READ .*cheatsheet\.md before writing a fix\.$/,
    );
  });

  it("leaves the error untouched for humans", () => {
    const error = appendAgentFixGuide(new Error("Route conflict"));
    assert.equal(error.message, "Route conflict");
  });

  it("appends the pointer at most once", () => {
    process.env.CURSOR_AGENT = "1";
    const error = appendAgentFixGuide(new Error("Route conflict"));
    const tagged = error.message;
    appendAgentFixGuide(error);
    assert.equal(error.message, tagged);
    assert.equal((tagged.match(/Fix guide:/g) || []).length, 1);
  });

  it("passes non-errors through untouched", () => {
    process.env.CLAUDECODE = "1";
    const value = { not: "an error" };
    assert.equal(appendAgentFixGuide(value), value);
  });

  it("gives a coding agent a cheat-sheet pointer for non-routable warnings", () => {
    process.env.CLAUDECODE = "1";
    assert.match(
      agentRouteFixGuide(),
      /^ READ .*cheatsheet\.md before changing route files\.$/,
    );
  });

  it("adds nothing to warnings for humans", () => {
    assert.equal(agentRouteFixGuide(), "");
  });
});
