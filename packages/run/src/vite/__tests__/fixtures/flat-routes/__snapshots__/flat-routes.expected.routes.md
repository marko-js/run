# Routes

## Middleware
```js
// virtual:marko-run/__marko-run__middleware.js
import { normalize } from "virtual:marko-run/runtime/internal";
import middleware3 from "./src/routes/$id,a.d+middleware.marko";

export const mware3 = normalize(middleware3);
```
---

## Route ``route``
### Path: ``/``
### Handler
```js
// virtual:marko-run__marko-run__route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,$id,$$rest,+page.marko?marko-server-entry";

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
import { normalize, call, noContent, pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.get_post.marko";
import page from "./src/routes/foo,$id,$$rest,+page.marko?marko-server-entry";

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get2(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	return call(getHandler, __page, context);
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}

export function post2(context) {
	return call(postHandler, noContent, context);
}
```
---
## Route ``$/route``
### Path: ``/$id``
### Handler
```js
// virtual:marko-run__marko-run__$.route.js
import { call, pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware3 } from "virtual:marko-run/__marko-run__middleware.js";
import page from "./src/routes/foo,$id,$$rest,+page.marko?marko-server-entry";

export function get3(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	return call(mware3, __page, context);
}

export function head3(context, buildInput) {
	return stripResponseBody(get3(context, buildInput));
}
```
---
## Route ``$$/route``
### Path: ``/$$rest``
### Handler
```js
// virtual:marko-run__marko-run__$$.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,$id,$$rest,+page.marko?marko-server-entry";

export function get4(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head4(context, buildInput) {
	return stripResponseBody(get4(context, buildInput));
}
```
---
## Route ``a/c/route``
### Path: ``/a/c``
### Handler
```js
// virtual:marko-run__marko-run__a.c.route.js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.get_post.marko";

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get5(context) {
	return call(getHandler, noContent, context);
}

export function head5(context) {
	return stripResponseBody(get5(context));
}

export function post5(context) {
	return call(postHandler, noContent, context);
}
```
---
## Route ``a/d/route``
### Path: ``/a/d``
### Handler
```js
// virtual:marko-run__marko-run__a.d.route.js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware3 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.get_post.marko";

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get6(context) {
	const __getHandler = () => call(getHandler, noContent, context);
	return call(mware3, __getHandler, context);
}

export function head6(context) {
	return stripResponseBody(get6(context));
}

export function post6(context) {
	const __postHandler = () => call(postHandler, noContent, context);
	return call(mware3, __postHandler, context);
}
```
---
## Route ``b/c/route``
### Path: ``/b/c``
### Handler
```js
// virtual:marko-run__marko-run__b.c.route.js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.get_post.marko";

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get7(context) {
	return call(getHandler, noContent, context);
}

export function head7(context) {
	return stripResponseBody(get7(context));
}

export function post7(context) {
	return call(postHandler, noContent, context);
}
```
---
## Route ``b/d/route``
### Path: ``/b/d``
### Handler
```js
// virtual:marko-run__marko-run__b.d.route.js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.get_post.marko";

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get8(context) {
	return call(getHandler, noContent, context);
}

export function head8(context) {
	return stripResponseBody(get8(context));
}

export function post8(context) {
	return call(postHandler, noContent, context);
}
```
