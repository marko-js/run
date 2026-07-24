// Agent env markers alter error output (see vite/utils/agent-fix-guide.ts),
// which would break snapshot expectations recorded without them.
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
