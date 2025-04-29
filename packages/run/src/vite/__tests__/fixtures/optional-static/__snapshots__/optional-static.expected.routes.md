# Routes

## Route ``route``
### Path: ``/``
### Handler
```js
// virtual:marko-run__marko-run__route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get1(context) {
	return context.render(page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
---
## Route ``foo/route``
### Path: ``/foo``
### Handler
```js
// virtual:marko-run__marko-run__foo.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get2(context) {
	return context.render(page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
---
## Route ``foo/bar/route``
### Path: ``/foo/bar``
### Handler
```js
// virtual:marko-run__marko-run__foo.bar.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get3(context) {
	return context.render(page, {});
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
---
## Route ``foo/bar/baz/route``
### Path: ``/foo/bar/baz``
### Handler
```js
// virtual:marko-run__marko-run__foo.bar.baz.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get4(context) {
	return context.render(page, {});
}

export function head4(context) {
	return stripResponseBody(get4(context));
}
```
---
## Route ``foo/baz/route``
### Path: ``/foo/baz``
### Handler
```js
// virtual:marko-run__marko-run__foo.baz.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get5(context) {
	return context.render(page, {});
}

export function head5(context) {
	return stripResponseBody(get5(context));
}
```
---
## Route ``bar/route``
### Path: ``/bar``
### Handler
```js
// virtual:marko-run__marko-run__bar.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get6(context) {
	return context.render(page, {});
}

export function head6(context) {
	return stripResponseBody(get6(context));
}
```
---
## Route ``bar/baz/route``
### Path: ``/bar/baz``
### Handler
```js
// virtual:marko-run__marko-run__bar.baz.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get7(context) {
	return context.render(page, {});
}

export function head7(context) {
	return stripResponseBody(get7(context));
}
```
---
## Route ``baz/route``
### Path: ``/baz``
### Handler
```js
// virtual:marko-run__marko-run__baz.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get8(context) {
	return context.render(page, {});
}

export function head8(context) {
	return stripResponseBody(get8(context));
}
```
