# Routes

## Route ``a%3fb/$/$/route``
### Path: ``/a%3fb/$`$id`/$foo``
### Handler
```js
// virtual:marko-run__marko-run__a%3fb.$.$.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/`a?b`/$`$id`/$foo/+page.marko?marko-server-entry";

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route ``a%3fb/baz/route``
### Path: ``/a%3fb/baz``
### Handler
```js
// virtual:marko-run__marko-run__a%3fb.baz.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/`a?b`/baz/+page.marko?marko-server-entry";

export function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}
```
