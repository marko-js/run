# Routes

## Route ``index``
### Path: ``/``
### Handler
```js
// virtual:marko-run__marko-run__index.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/+page.marko";

export function get1(context) {
	return context.render(page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
---
## Route ``+routes``
### Path: ``/+routes``
### Handler
```js
// virtual:marko-run__marko-run__+routes.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/+page.marko";

export function get2(context) {
	return context.render(page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
