# Routes

## Route ``route``
### Path: ``/``
### Handler
```js
// virtual:marko-run__marko-run__route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route ``foo/route``
### Path: ``/foo``
### Handler
```js
// virtual:marko-run__marko-run__foo.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}
```
---
## Route ``foo/bar/route``
### Path: ``/foo/bar``
### Handler
```js
// virtual:marko-run__marko-run__foo.bar.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get3(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head3(context, buildInput) {
	return stripResponseBody(get3(context, buildInput));
}
```
---
## Route ``foo/bar/baz/route``
### Path: ``/foo/bar/baz``
### Handler
```js
// virtual:marko-run__marko-run__foo.bar.baz.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get4(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head4(context, buildInput) {
	return stripResponseBody(get4(context, buildInput));
}
```
---
## Route ``foo/baz/route``
### Path: ``/foo/baz``
### Handler
```js
// virtual:marko-run__marko-run__foo.baz.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get5(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head5(context, buildInput) {
	return stripResponseBody(get5(context, buildInput));
}
```
---
## Route ``bar/route``
### Path: ``/bar``
### Handler
```js
// virtual:marko-run__marko-run__bar.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get6(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head6(context, buildInput) {
	return stripResponseBody(get6(context, buildInput));
}
```
---
## Route ``bar/baz/route``
### Path: ``/bar/baz``
### Handler
```js
// virtual:marko-run__marko-run__bar.baz.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get7(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head7(context, buildInput) {
	return stripResponseBody(get7(context, buildInput));
}
```
---
## Route ``baz/route``
### Path: ``/baz``
### Handler
```js
// virtual:marko-run__marko-run__baz.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry";

export function get8(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head8(context, buildInput) {
	return stripResponseBody(get8(context, buildInput));
}
```
