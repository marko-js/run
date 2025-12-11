# Routes

## Route ``$.$``
### Path: ``/$foo/$bar``
### Handler
```js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$foo,/$bar,$$rest/+page.marko";

export function get1(context) {
	return context.render(page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
---
## Route ``$.$$``
### Path: ``/$foo/$$rest``
### Handler
```js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$foo,/$bar,$$rest/+page.marko";

export function get2(context) {
	return context.render(page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
---
## Route ``$``
### Path: ``/$bar``
### Handler
```js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$foo,/$bar,$$rest/+page.marko";

export function get3(context) {
	return context.render(page, {});
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
---
## Route ``$$``
### Path: ``/$$rest``
### Handler
```js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$foo,/$bar,$$rest/+page.marko";

export function get4(context) {
	return context.render(page, {});
}

export function head4(context) {
	return stripResponseBody(get4(context));
}
```
