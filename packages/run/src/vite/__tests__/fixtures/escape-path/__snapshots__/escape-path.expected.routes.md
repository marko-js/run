# Routes

## Route ``a%3fb/$/$/route``
### Path: ``/a%3fb/$`$id`/$foo``
### Handler
```js
// virtual:marko-run__marko-run__a%3fb.$.$.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/`a?b`/$`$id`/$foo/+page.marko?marko-server-entry";

export function get1(context) {
	return context.render(page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
---
## Route ``a%3fb/baz/route``
### Path: ``/a%3fb/baz``
### Handler
```js
// virtual:marko-run__marko-run__a%3fb.baz.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/`a?b`/baz/+page.marko?marko-server-entry";

export function get2(context) {
	return context.render(page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
