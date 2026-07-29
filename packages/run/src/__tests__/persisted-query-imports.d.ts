// The persisted client keeps module-level navigation state, so tests that
// need a fresh instance import it with a cache-busting query. The query is
// runtime-only (tsx re-evaluates the module); these declarations give each
// variant the real module's types instead of an unresolvable specifier.
declare module "*persisted.js?traversal" {
  export const register: typeof import("../runtime/persisted.js").register;
}
declare module "*persisted.js?popstate-wins" {
  export const register: typeof import("../runtime/persisted.js").register;
}
declare module "*persisted.js?bfcache" {
  export const register: typeof import("../runtime/persisted.js").register;
}
