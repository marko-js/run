# Routes

## Middleware
```js
import { normalizeHandler } from "virtual:marko-run/runtime/internal";
import middleware4 from "./src/routes/+middleware.ts";
import middleware5 from "./src/routes/_protected/+middleware.ts";
import middleware7 from "./src/routes/_protected/_home/+middleware.ts";
import middleware13 from "./src/routes/_protected/_home/notes/$id/+middleware.ts";

export const mware4 = normalizeHandler(middleware4);
export const mware5 = normalizeHandler(middleware5);
export const mware7 = normalizeHandler(middleware7);
export const mware13 = normalizeHandler(middleware13);
```
---

## Route ``index``
### Path: ``/``
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Layout2 from "../../src/routes/_protected/_home/+layout.marko";
import Page from "../../src/routes/_protected/_home/+page.marko";

<Layout1>
	<Layout2>
		<Page/>
	</>
</>
```
### Handler
```js
import { call, mergeOptions, render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4, mware5, mware7 } from "virtual:marko-run/__marko-run__middleware.js";
import page from "./dist/.marko-run/index.marko";

export const get3_options = mergeOptions(mware4, mware5, mware7);
export const head3_options = mergeOptions(mware4, mware5, mware7);

export function get3(context) {
	const __page = (data) => render(context, page, {}, data);
	const __mware7 = (data) => call(mware7, __page, context, data);
	const __mware5 = (data) => call(mware5, __mware7, context, data);
	return call(mware4, __mware5, context);
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
---
## Route ``new``
### Path: ``/new``
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Layout2 from "../../src/routes/_protected/_home/+layout.marko";
import Page from "../../src/routes/_protected/_home/new/+page.marko";

<Layout1>
	<Layout2>
		<Page/>
	</>
</>
```
### Handler
```js
import { normalizeHandler, normalizeMeta, call, mergeOptions, render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4, mware5, mware7 } from "virtual:marko-run/__marko-run__middleware.js";
import { POST } from "./src/routes/_protected/_home/new/+handler.ts";
import page from "./dist/.marko-run/new.marko";
import meta4 from "./src/routes/_protected/_home/new/+meta.json";

const postHandler = normalizeHandler(POST);

export const { GET: get4_meta, GET: head4_meta, POST: post4_meta } = normalizeMeta(meta4);

export const get4_options = mergeOptions(mware4, mware5, mware7);
export const head4_options = mergeOptions(mware4, mware5, mware7);
export const post4_options = mergeOptions(mware4, mware5, mware7, postHandler);

export function get4(context) {
	const __page = (data) => render(context, page, {}, data);
	const __mware7 = (data) => call(mware7, __page, context, data);
	const __mware5 = (data) => call(mware5, __mware7, context, data);
	return call(mware4, __mware5, context);
}

export function head4(context) {
	return stripResponseBody(get4(context));
}

export function post4(context) {
	const __page = (data) => render(context, page, {}, data);
	const __postHandler = (data) => call(postHandler, __page, context, data);
	const __mware7 = (data) => call(mware7, __postHandler, context, data);
	const __mware5 = (data) => call(mware5, __mware7, context, data);
	return call(mware4, __mware5, context);
}
```
---
## Route ``notes.$``
### Path: ``/notes/$id``
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Layout2 from "../../src/routes/_protected/_home/+layout.marko";
import Page from "../../src/routes/_protected/_home/notes/$id/+page.marko";

<Layout1>
	<Layout2>
		<Page/>
	</>
</>
```
### Handler
```js
import { normalizeHandler, call, mergeOptions, render, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4, mware5, mware7, mware13 } from "virtual:marko-run/__marko-run__middleware.js";
import { PUT, POST, DELETE } from "./src/routes/_protected/_home/notes/$id/+handler.ts";
import page from "./dist/.marko-run/notes.$.marko";

const putHandler = normalizeHandler(PUT);
const postHandler = normalizeHandler(POST);
const deleteHandler = normalizeHandler(DELETE);

export const get5_options = mergeOptions(mware4, mware5, mware7, mware13);
export const head5_options = mergeOptions(mware4, mware5, mware7, mware13);
export const post5_options = mergeOptions(mware4, mware5, mware7, mware13, postHandler);
export const put5_options = mergeOptions(mware4, mware5, mware7, mware13, putHandler);
export const delete5_options = mergeOptions(mware4, mware5, mware7, mware13, deleteHandler);

export function get5(context) {
	const __page = (data) => render(context, page, {}, data);
	const __mware13 = (data) => call(mware13, __page, context, data);
	const __mware7 = (data) => call(mware7, __mware13, context, data);
	const __mware5 = (data) => call(mware5, __mware7, context, data);
	return call(mware4, __mware5, context);
}

export function head5(context) {
	return stripResponseBody(get5(context));
}

export function post5(context) {
	const __page = (data) => render(context, page, {}, data);
	const __postHandler = (data) => call(postHandler, __page, context, data);
	const __mware13 = (data) => call(mware13, __postHandler, context, data);
	const __mware7 = (data) => call(mware7, __mware13, context, data);
	const __mware5 = (data) => call(mware5, __mware7, context, data);
	return call(mware4, __mware5, context);
}

export function put5(context) {
	const __putHandler = (data) => call(putHandler, noContent, context, data);
	const __mware13 = (data) => call(mware13, __putHandler, context, data);
	const __mware7 = (data) => call(mware7, __mware13, context, data);
	const __mware5 = (data) => call(mware5, __mware7, context, data);
	return call(mware4, __mware5, context);
}

export function delete5(context) {
	const __deleteHandler = (data) => call(deleteHandler, noContent, context, data);
	const __mware13 = (data) => call(mware13, __deleteHandler, context, data);
	const __mware7 = (data) => call(mware7, __mware13, context, data);
	const __mware5 = (data) => call(mware5, __mware7, context, data);
	return call(mware4, __mware5, context);
}
```
---
## Route ``notes.$.comments``
### Path: ``/notes/$id/comments``
### Handler
```js
import { normalizeHandler, normalizeMeta, call, mergeOptions, noContent } from "virtual:marko-run/runtime/internal";
import { mware4, mware5, mware7, mware13 } from "virtual:marko-run/__marko-run__middleware.js";
import { PUT, POST, DELETE } from "./src/routes/_protected/_home/notes/$id/comments/+handler.ts";
import meta6 from "./src/routes/_protected/_home/notes/$id/comments/+meta.ts";

const putHandler = normalizeHandler(PUT);
const postHandler = normalizeHandler(POST);
const deleteHandler = normalizeHandler(DELETE);

export const { POST: post6_meta, PUT: put6_meta, DELETE: delete6_meta } = normalizeMeta(meta6);

export const post6_options = mergeOptions(mware4, mware5, mware7, mware13, postHandler);
export const put6_options = mergeOptions(mware4, mware5, mware7, mware13, putHandler);
export const delete6_options = mergeOptions(mware4, mware5, mware7, mware13, deleteHandler);

export function post6(context) {
	const __postHandler = (data) => call(postHandler, noContent, context, data);
	const __mware13 = (data) => call(mware13, __postHandler, context, data);
	const __mware7 = (data) => call(mware7, __mware13, context, data);
	const __mware5 = (data) => call(mware5, __mware7, context, data);
	return call(mware4, __mware5, context);
}

export function put6(context) {
	const __putHandler = (data) => call(putHandler, noContent, context, data);
	const __mware13 = (data) => call(mware13, __putHandler, context, data);
	const __mware7 = (data) => call(mware7, __mware13, context, data);
	const __mware5 = (data) => call(mware5, __mware7, context, data);
	return call(mware4, __mware5, context);
}

export function delete6(context) {
	const __deleteHandler = (data) => call(deleteHandler, noContent, context, data);
	const __mware13 = (data) => call(mware13, __deleteHandler, context, data);
	const __mware7 = (data) => call(mware7, __mware13, context, data);
	const __mware5 = (data) => call(mware5, __mware7, context, data);
	return call(mware4, __mware5, context);
}
```
---
## Route ``callback.oauth2``
### Path: ``/callback/oauth2``
### Handler
```js
import { normalizeHandler, call, mergeOptions, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET } from "./src/routes/callback/oauth2/+handler.ts";

const getHandler = normalizeHandler(GET);

export const get7_options = mergeOptions(mware4, getHandler);
export const head7_options = mergeOptions(mware4);

export function get7(context) {
	const __getHandler = (data) => call(getHandler, noContent, context, data);
	return call(mware4, __getHandler, context);
}

export function head7(context) {
	return stripResponseBody(get7(context));
}
```
---
## Route ``my``
### Path: ``/my``
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/my/+page.marko";

<Layout1>
	<Page/>
</>
```
### Handler
```js
import { normalizeHandler, call, mergeOptions, render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET, HEAD } from "./src/routes/my/+handler.ts";
import page from "./dist/.marko-run/my.marko";

const getHandler = normalizeHandler(GET);
const headHandler = normalizeHandler(HEAD);

export const get8_options = mergeOptions(mware4, getHandler);
export const head8_options = mergeOptions(mware4, headHandler);

export function get8(context) {
	const __page = (data) => render(context, page, {}, data);
	const __getHandler = (data) => call(getHandler, __page, context, data);
	return call(mware4, __getHandler, context);
}

export function head8(context) {
	const __page = (data) => render(context, page, {}, data);
	const __headHandler = (data) => call(headHandler, __page, context, data);
	return stripResponseBody(call(mware4, __headHandler, context));
}
```
---
## Route ``$$``
### Path: ``/$$match``
### Handler
```js
import { normalizeHandler, call, mergeOptions, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET } from "./src/routes/$$match/+handler.ts";

const getHandler = normalizeHandler(GET);

export const get9_options = mergeOptions(mware4, getHandler);
export const head9_options = mergeOptions(mware4);

export function get9(context) {
	const __getHandler = (data) => call(getHandler, noContent, context, data);
	return call(mware4, __getHandler, context);
}

export function head9(context) {
	return stripResponseBody(get9(context));
}
```


## Special `404`
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+404.marko";

<Layout1>
	<Page/>
</>
```


## Special `500`
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+500.marko";

<Layout1>
	<Page error=input.error/>
</>
```
