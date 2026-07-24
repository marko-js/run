// Loaded via .mocharc.json `require`. Snapshot expectations are recorded in a
// human terminal, but `@marko/run` changes its error/warning output when a
// coding-agent env marker is present (see
// packages/run/src/vite/utils/agent-fix-guide.ts), which made the suite fail
// whenever an agent ran `npm test`. Strip the markers up front — child
// processes spawned by fixtures inherit the cleaned env, and tests that cover
// the agent behavior set the vars themselves.
for (const key of [
  "CLAUDECODE",
  "CLAUDE_CODE",
  "CURSOR_AGENT",
  "GEMINI_CLI",
  "CODEX_SANDBOX",
  "CODEX_THREAD_ID",
  "AI_AGENT",
]) {
  delete process.env[key];
}
