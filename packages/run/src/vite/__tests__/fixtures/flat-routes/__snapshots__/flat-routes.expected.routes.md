# Routes

## Middleware
```js
import { normalizeHandler } from "virtual:marko-run/runtime/internal";
import middleware3, * as middlewareModule3 from "./src/routes/$id,a.d+middleware.marko";

export const mware3 = normalizeHandler(middleware3);
export const mwareOptions3 = middlewareModule3.options;
```
---

## Route ``index``
### Path: ``/``
### Template
```marko
import Page from "../../src/routes/foo,$id,$$rest,+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/index.marko";

export const get1_options = {};
export const head1_options = {};

export function get1(context) {
	return render(context, page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
---
## Route ``foo``
### Path: ``/foo``
### Template
```marko
import Page from "../../src/routes/foo,$id,$$rest,+page.marko";

<Page/>
```
### Handler
```js
import { normalizeHandler, call, normalizeOptions, render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.marko";
import * as handlerModule from "./src/routes/foo,(a,b).(c,d)+handler.marko";
import page from "./dist/.marko-run/foo.marko";

const getHandler = normalizeHandler(GET, 'GET');
const postHandler = normalizeHandler(POST, 'POST');

export const get2_options = normalizeOptions('GET', handlerModule.options, getHandler);
export const head2_options = {};
export const post2_options = normalizeOptions('POST', handlerModule.options, postHandler);

export function get2(context) {
	const __page = (data) => render(context, page, {}, data);
	return call(getHandler, __page, context);
}

export function head2(context) {
	return stripResponseBody(get2(context));
}

export function post2(context) {
	const __page = (data) => render(context, page, {}, data);
	return call(postHandler, __page, context);
}
```
---
## Route ``$``
### Path: ``/$id``
### Template
```marko
import Page from "../../src/routes/foo,$id,$$rest,+page.marko";

<Page/>
```
### Handler
```js
import { call, normalizeOptions, render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware3, mwareOptions3 } from "virtual:marko-run/__marko-run__middleware.js";
import page from "./dist/.marko-run/$.marko";

export const get3_options = normalizeOptions('GET', mwareOptions3, mware3);
export const head3_options = normalizeOptions('HEAD', mwareOptions3, mware3);

export function get3(context) {
	const __page = (data) => render(context, page, {}, data);
	return call(mware3, __page, context);
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
---
## Route ``$$``
### Path: ``/$$rest``
### Template
```marko
import Page from "../../src/routes/foo,$id,$$rest,+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/$$.marko";

export const get4_options = {};
export const head4_options = {};

export function get4(context) {
	return render(context, page, {});
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
import { normalizeHandler, call, normalizeOptions, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.marko";
import * as handlerModule from "./src/routes/foo,(a,b).(c,d)+handler.marko";

const getHandler = normalizeHandler(GET, 'GET');
const postHandler = normalizeHandler(POST, 'POST');

export const get5_options = normalizeOptions('GET', handlerModule.options, getHandler);
export const head5_options = {};
export const post5_options = normalizeOptions('POST', handlerModule.options, postHandler);

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
import { normalizeHandler, call, normalizeOptions, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware3, mwareOptions3 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.marko";
import * as handlerModule from "./src/routes/foo,(a,b).(c,d)+handler.marko";

const getHandler = normalizeHandler(GET, 'GET');
const postHandler = normalizeHandler(POST, 'POST');

export const get6_options = normalizeOptions('GET', mwareOptions3, mware3, handlerModule.options, getHandler);
export const head6_options = normalizeOptions('HEAD', mwareOptions3, mware3);
export const post6_options = normalizeOptions('POST', mwareOptions3, mware3, handlerModule.options, postHandler);

export function get6(context) {
	const __getHandler = (data) => call(getHandler, noContent, context, data);
	return call(mware3, __getHandler, context);
}

export function head6(context) {
	return stripResponseBody(get6(context));
}

export function post6(context) {
	const __postHandler = (data) => call(postHandler, noContent, context, data);
	return call(mware3, __postHandler, context);
}
```
---
## Route ``b.c``
### Path: ``/b/c``
### Handler
```js
import { normalizeHandler, call, normalizeOptions, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.marko";
import * as handlerModule from "./src/routes/foo,(a,b).(c,d)+handler.marko";

const getHandler = normalizeHandler(GET, 'GET');
const postHandler = normalizeHandler(POST, 'POST');

export const get7_options = normalizeOptions('GET', handlerModule.options, getHandler);
export const head7_options = {};
export const post7_options = normalizeOptions('POST', handlerModule.options, postHandler);

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
import { normalizeHandler, call, normalizeOptions, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, POST } from "./src/routes/foo,(a,b).(c,d)+handler.marko";
import * as handlerModule from "./src/routes/foo,(a,b).(c,d)+handler.marko";

const getHandler = normalizeHandler(GET, 'GET');
const postHandler = normalizeHandler(POST, 'POST');

export const get8_options = normalizeOptions('GET', handlerModule.options, getHandler);
export const head8_options = {};
export const post8_options = normalizeOptions('POST', handlerModule.options, postHandler);

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
