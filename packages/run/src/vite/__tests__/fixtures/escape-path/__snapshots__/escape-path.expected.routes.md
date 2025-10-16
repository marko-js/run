# Routes

## Route ``a%3fb.$.$``
### Path: ``/a%3fb/$`$id`/$foo``
### Handler
```js
// virtual:marko-run__marko-run__a%3fb.$.$.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/`a?b`/$`$id`/$foo/+page.marko";

export function get1(context) {
	return context.render(page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
---
## Route ``a%3fb.baz``
### Path: ``/a%3fb/baz``
### Handler
```js
// virtual:marko-run__marko-run__a%3fb.baz.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/`a?b`/baz/+page.marko";

export function get2(context) {
	return context.render(page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
