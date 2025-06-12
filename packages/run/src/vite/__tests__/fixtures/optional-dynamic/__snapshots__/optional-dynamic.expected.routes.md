# Routes

## Route ``$/$/route``
### Path: ``/$foo/$bar``
### Handler
```js
// virtual:marko-run__marko-run__$.$.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry";

export function get1(context) {
	return context.render(page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
---
## Route ``$/$$/route``
### Path: ``/$foo/$$rest``
### Handler
```js
// virtual:marko-run__marko-run__$.$$.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry";

export function get2(context) {
	return context.render(page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
---
## Route ``$/route``
### Path: ``/$bar``
### Handler
```js
// virtual:marko-run__marko-run__$.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry";

export function get3(context) {
	return context.render(page, {});
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
---
## Route ``$$/route``
### Path: ``/$$rest``
### Handler
```js
// virtual:marko-run__marko-run__$$.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry";

export function get4(context) {
	return context.render(page, {});
}

export function head4(context) {
	return stripResponseBody(get4(context));
}
```
