# Routes

## Middleware
```js
import { normalizeHandler } from "virtual:marko-run/runtime/internal";
import middleware3, * as middlewareModule3 from "./src/routes/+middleware.ts";

export const mware3 = normalizeHandler(middleware3);
export const mwareOptions3 = middlewareModule3.options;
```
---

## Route ``index``
### Path: ``/``
### Template
```marko
import Page from "../../src/routes/+page.marko";

<Page/>
```
### Handler
```js
import { normalizeHandler, call, normalizeOptions, render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware3, mwareOptions3 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET, POST } from "./src/routes/+handler.marko";
import * as handlerModule from "./src/routes/+handler.marko";
import page from "./dist/.marko-run/index.marko";

const getHandler = normalizeHandler(GET, 'GET');
const postHandler = normalizeHandler(POST, 'POST');

export const get1_options = normalizeOptions('GET', mwareOptions3, mware3, handlerModule.options, getHandler);
export const head1_options = normalizeOptions('HEAD', mwareOptions3, mware3);
export const post1_options = normalizeOptions('POST', mwareOptions3, mware3, handlerModule.options, postHandler);

export function get1(context) {
	const __page = (data) => render(context, page, {}, data);
	const __getHandler = (data) => call(getHandler, __page, context, data);
	return call(mware3, __getHandler, context);
}

export function head1(context) {
	return stripResponseBody(get1(context));
}

export function post1(context) {
	const __page = (data) => render(context, page, {}, data);
	const __postHandler = (data) => call(postHandler, __page, context, data);
	return call(mware3, __postHandler, context);
}
```
