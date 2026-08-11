---
"@marko/run": patch
---

Give each dev server its own working HMR websocket. Vite's middleware mode binds a fixed default port, so a second `marko-run dev` instance on the same machine failed to bind it — with the error message swallowed — and its live reload silently connected to the first instance. A dev server whose config names no HMR port (nor a server or client port to honor) now keeps Vite's default port while it is free and allocates a free one otherwise.
