# Routes

## Middleware
```js
import { normalizeHandler } from "virtual:marko-run/runtime/internal";
import middleware3 from "./src/routes/+middleware.ts";

export const mware3 = normalizeHandler(middleware3);
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
import { normalizeHandler, call, mergeOptions, render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware3 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET, POST } from "./src/routes/+handler.marko";
import page from "./dist/.marko-run/index.marko";

const getHandler = normalizeHandler(GET);
const postHandler = normalizeHandler(POST);

export const get1_options = mergeOptions(mware3, getHandler);
export const head1_options = mergeOptions(mware3);
export const post1_options = mergeOptions(mware3, postHandler);

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
