# Routes

## Route ``foo.bar``
### Path: ``/foo/bar``
### Handler
```js
import { normalizeHandler, normalizeMeta, call, mergeOptions, noContent } from "virtual:marko-run/runtime/internal";
import { PUT, POST, DELETE } from "./src/routes/foo/bar/+handler.ts";
import meta1 from "./src/routes/foo/bar/+meta.ts";

const putHandler = normalizeHandler(PUT);
const postHandler = normalizeHandler(POST);
const deleteHandler = normalizeHandler(DELETE);

export const { POST: post1_meta, PUT: put1_meta, DELETE: delete1_meta } = normalizeMeta(meta1);

export const post1_options = mergeOptions(postHandler);
export const put1_options = mergeOptions(putHandler);
export const delete1_options = mergeOptions(deleteHandler);

export function post1(context) {
	return call(postHandler, noContent, context);
}

export function put1(context) {
	return call(putHandler, noContent, context);
}

export function delete1(context) {
	return call(deleteHandler, noContent, context);
}
```
---
## Route ``foo.baz``
### Path: ``/foo/baz``
### Template
```marko
import Page from "../../src/routes/foo/baz/+page.marko";

<Page/>
```
### Handler
```js
import { normalizeHandler, normalizeMeta, call, mergeOptions, render, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { PUT, POST, DELETE } from "./src/routes/foo/baz/+handler.ts";
import page from "./dist/.marko-run/foo.baz.marko";
import meta2 from "./src/routes/foo/baz/+meta.json";

const putHandler = normalizeHandler(PUT);
const postHandler = normalizeHandler(POST);
const deleteHandler = normalizeHandler(DELETE);

export const { GET: get2_meta, GET: head2_meta, POST: post2_meta, PUT: put2_meta, DELETE: delete2_meta } = normalizeMeta(meta2);

export const get2_options = {};
export const head2_options = {};
export const post2_options = mergeOptions(postHandler);
export const put2_options = mergeOptions(putHandler);
export const delete2_options = mergeOptions(deleteHandler);

export function get2(context) {
	return render(context, page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}

export function post2(context) {
	const __page = (data) => render(context, page, {}, data);
	return call(postHandler, __page, context);
}

export function put2(context) {
	return call(putHandler, noContent, context);
}

export function delete2(context) {
	return call(deleteHandler, noContent, context);
}
```
