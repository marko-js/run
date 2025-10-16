# Routes

## Route ``index``
### Path: ``/``
### Handler
```js
// virtual:marko-run__marko-run__index.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko";

export function get1(context) {
	return context.render(page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
---
## Route ``foo``
### Path: ``/foo``
### Handler
```js
// virtual:marko-run__marko-run__foo.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko";

export function get2(context) {
	return context.render(page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
---
## Route ``foo.bar``
### Path: ``/foo/bar``
### Handler
```js
// virtual:marko-run__marko-run__foo.bar.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko";

export function get3(context) {
	return context.render(page, {});
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
---
## Route ``foo.bar.baz``
### Path: ``/foo/bar/baz``
### Handler
```js
// virtual:marko-run__marko-run__foo.bar.baz.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko";

export function get4(context) {
	return context.render(page, {});
}

export function head4(context) {
	return stripResponseBody(get4(context));
}
```
---
## Route ``foo.baz``
### Path: ``/foo/baz``
### Handler
```js
// virtual:marko-run__marko-run__foo.baz.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko";

export function get5(context) {
	return context.render(page, {});
}

export function head5(context) {
	return stripResponseBody(get5(context));
}
```
---
## Route ``bar``
### Path: ``/bar``
### Handler
```js
// virtual:marko-run__marko-run__bar.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko";

export function get6(context) {
	return context.render(page, {});
}

export function head6(context) {
	return stripResponseBody(get6(context));
}
```
---
## Route ``bar.baz``
### Path: ``/bar/baz``
### Handler
```js
// virtual:marko-run__marko-run__bar.baz.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko";

export function get7(context) {
	return context.render(page, {});
}

export function head7(context) {
	return stripResponseBody(get7(context));
}
```
---
## Route ``baz``
### Path: ``/baz``
### Handler
```js
// virtual:marko-run__marko-run__baz.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko";

export function get8(context) {
	return context.render(page, {});
}

export function head8(context) {
	return stripResponseBody(get8(context));
}
```
