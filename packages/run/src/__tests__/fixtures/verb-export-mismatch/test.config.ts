// The preview server imports every route entry at boot, so this build
// crashes the process before the harness can talk to it -- which is the
// intended production behavior, but only dev can be asserted here.
export const skip_preview = true;

export const path = "/mm";
