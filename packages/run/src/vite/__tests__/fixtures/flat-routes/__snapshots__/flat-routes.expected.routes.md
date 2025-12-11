# Routes

## Middleware
```js
import { normalize } from "virtual:marko-run/runtime/internal";
import middleware3 from "./src/routes/$id,a.d+middleware.marko";

export const mware3 = normalize(middleware3);
```
---

## Route ``index``
### Path: ``/``
### Handler
```js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo,$id,$$rest,+page.marko";

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
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.marko";
import page from "./src/routes/foo,$id,$$rest,+page.marko";

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get2(context) {
	const __page = () => context.render(page, {});
	return call(getHandler, __page, context);
}

export function head2(context) {
	return stripResponseBody(get2(context));
}

export function post2(context) {
	return call(postHandler, noContent, context);
}
```
---
## Route ``$``
### Path: ``/$id``
### Handler
```js
import { call, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware3 } from "virtual:marko-run/__marko-run__middleware.js";
import page from "./src/routes/foo,$id,$$rest,+page.marko";

export function get3(context) {
	const __page = () => context.render(page, {});
	return call(mware3, __page, context);
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
import page from "./src/routes/foo,$id,$$rest,+page.marko";

export function get4(context) {
	return context.render(page, {});
}

export function head4(context) {
	return stripResponseBody(get4(context));
}
```
---
## Route ``a.c``
### Path: ``/a/c``
### Handler
```js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.marko";

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
## Route ``a.d``
### Path: ``/a/d``
### Handler
```js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware3 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.marko";

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
## Route ``b.c``
### Path: ``/b/c``
### Handler
```js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.marko";

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
## Route ``b.d``
### Path: ``/b/d``
### Handler
```js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.marko";

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
