# Agent Feedback

Actionable observations that were **out of scope for the task that surfaced them**. If something is in scope, fix it instead. Do not expand a task's diff to fix issues recorded here.

Same conventions as [`marko-js/marko`'s `agent-feedback/`](https://github.com/marko-js/marko/tree/main/agent-feedback): search the category file first, be self-contained, append to the end, delete entries when resolved, verify claims before recording.

- suspected bugs → `bugs.md`
- cleanup/refactor opportunities → `cleanup.md`
- perf/bundle-size opportunities → `perf.md`
- tooling/workflow/user-facing friction → `dx.md`
- confusing code or docs → `unclear.md`

## Entry format

```md
## <one-line imperative summary>

`<primary/file/path.ts:line>` | 2026-07-11 | impact:<low|med|high> | effort:<low|med|high>

<2–6 sentences: the problem, why it matters, and a concrete suggested direction.>
```
