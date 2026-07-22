import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);
const applied = new WeakSet<Error>();

/**
 * When a coding agent is driving the terminal, append a one-line pointer to
 * `@marko/run`'s cheat sheet onto a thrown compiler-level error so the agent
 * reads the routing conventions before attempting a fix. No-op for humans, for
 * errors already tagged, and when the cheat sheet cannot be resolved. Mirrors
 * the compiler's own fix-guide (marko-js/marko#3423) for `@marko/run`'s errors.
 */
export default function appendAgentFixGuide<T>(error: T): T {
  if (error instanceof Error && !applied.has(error) && isCodingAgent()) {
    const cheatsheet = cheatsheetPath();
    if (cheatsheet) {
      try {
        // `message` may be locked by the thrower (e.g. rolldown errors), so
        // redefine rather than assign. Best-effort: a frozen or otherwise
        // non-configurable error must never let augmentation mask the real
        // route/codegen failure this runs inside the catch path of.
        Object.defineProperty(error, "message", {
          value: `${error.message}\n\nFix guide: READ ${cheatsheet} before writing a fix.`,
          enumerable: true,
          writable: true,
          configurable: true,
        });
        applied.add(error);
      } catch {
        // Preserve the original diagnostic if it cannot be augmented.
      }
    }
  }

  return error;
}

/**
 * Agent-gated cheat-sheet pointer to append to a non-routable-file warning.
 * Empty for humans and when the cheat sheet cannot be resolved, so nothing
 * changes for a normal `marko-run dev`/`build`.
 */
export function agentRouteFixGuide(): string {
  if (isCodingAgent()) {
    const cheatsheet = cheatsheetPath();
    if (cheatsheet) return ` READ ${cheatsheet} before changing route files.`;
  }

  return "";
}

// Env markers terminal coding agents set.
function isCodingAgent() {
  return (
    typeof process === "object" &&
    !!(
      process.env.CLAUDECODE ||
      process.env.CLAUDE_CODE ||
      process.env.CURSOR_AGENT ||
      process.env.GEMINI_CLI ||
      process.env.CODEX_SANDBOX ||
      process.env.CODEX_THREAD_ID ||
      process.env.AI_AGENT
    )
  );
}

let cheatsheet: string | null | undefined;
function cheatsheetPath() {
  if (cheatsheet === undefined) {
    try {
      cheatsheet = path.relative(
        process.cwd(),
        require.resolve("@marko/run/cheatsheet.md"),
      );
    } catch {
      // Leave the real error/warning untouched if the sheet can't be resolved.
      cheatsheet = null;
    }
  }

  return cheatsheet ?? undefined;
}
