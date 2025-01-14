export function normalizeErrorStack(error: Error) {
  if (error.stack) {
    const match = /(.+(?:\r?\n\s*)?)/.exec(error.stack);
    error.stack = (match ? match[1] : "") + "at [Normalized Error Stack]";
  }
}
