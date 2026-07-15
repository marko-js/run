---
"@marko/run": patch
---

Fix `Run.*()` mutating shared handler functions and export internal types to resolve TS2883

`createDefineHandler` previously assigned the caller-supplied handler directly as the returned
handler object and then set `.verb` on it, which permanently tagged any reused utility function
with the first verb it was registered under. Passing the same function to a second `Run.*()` call
(e.g. a shared handler used in both `Run.GET` and `Run.POST([...])`) would then throw:

```text
Error: Expected verb POST but handler was defined with Run.GET
```

The fix wraps single-function arguments in a new closure so `.verb` is set on the wrapper, leaving
the original function unmodified and free to be reused across verbs.

`HandlerTypes`, `NormalizedHandlerFunction`, and `Typed` are now re-exported from the package
root. Without these exports, using the array overload of `Run.*()` on an exported handler constant
produced TS2883 ("The inferred type cannot be named without a reference to …/runtime/types"),
because TypeScript could not portably name those types in generated declaration files.
