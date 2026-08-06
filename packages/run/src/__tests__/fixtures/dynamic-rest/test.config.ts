// The encoded segment must come back decoded: `Run.href` percent-encodes
// every catch-all element, and the router owns the matching decode.
export const path = "/foo/caf%C3%A9/baz";
