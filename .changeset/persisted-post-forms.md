---
"@marko/run": patch
---

The persisted client router now intercepts POST form submissions as
PRG-shaped persisted updates: the mutation POSTs with update content
negotiation, the redirect's followed GET streams a patch that applies in
place (a same-URL refresh adds no history entry), and a
`marko-run:navigate` event fires after every applied navigation so app
code can re-read `$global` state the patch refreshed. Server-side
negotiation is method-agnostic — the route header is verified against the
final (post-redirect) URL's route, so cross-route redirects 409 into a
full navigation. Mutations are never replayed by the fallback ladder: with
a response in hand the final URL is followed with a plain GET; without
one, the submission is handed back to the browser (native resubmission
semantics). Non-2xx patch responses (a validation error re-rendering the
page) still apply in place, keeping focus and scroll. `enctype` is
honored (`multipart/form-data` posts FormData; `text/plain` stays native),
as are `formaction`/`formmethod`/`formenctype`/`formtarget` submitter
overrides.
