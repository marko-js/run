import type { RuntimeModule } from "./types";

function notImplemented(): never {
  throw new Error(
    "This should have been replaced by the @marko/run plugin at build/dev time"
  );
}

export const fetch = notImplemented as RuntimeModule['fetch'];
export const match = notImplemented as RuntimeModule['match'];
export const invoke = notImplemented as RuntimeModule['invoke'];
