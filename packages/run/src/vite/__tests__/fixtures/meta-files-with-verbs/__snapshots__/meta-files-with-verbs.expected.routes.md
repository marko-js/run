# Routes

## Route ``foo.bar``
### Path: ``/foo/bar``
### Handler
```js
import { normalizeHandler, normalizeMeta, call, noContent } from "virtual:marko-run/runtime/internal";
import { PUT, POST, DELETE } from "./src/routes/foo/bar/+handler.ts";
import meta1 from "./src/routes/foo/bar/+meta.ts";

const putHandler = normalizeHandler(PUT);
const postHandler = normalizeHandler(POST);
const deleteHandler = normalizeHandler(DELETE);

export const { POST: post1_meta, PUT: put1_meta, DELETE: delete1_meta } = normalizeMeta(meta1);

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
### Handler
```js
import { normalizeHandler, normalizeMeta, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { PUT, POST, DELETE } from "./src/routes/foo/baz/+handler.ts";
import page from "./src/routes/foo/baz/+page.marko";
import meta2 from "./src/routes/foo/baz/+meta.json";

const putHandler = normalizeHandler(PUT);
const postHandler = normalizeHandler(POST);
const deleteHandler = normalizeHandler(DELETE);

export const { GET: get2_meta, GET: head2_meta, POST: post2_meta, PUT: put2_meta, DELETE: delete2_meta } = normalizeMeta(meta2);

export function get2(context) {
	return context.render(page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}

export function post2(context) {
	return call(postHandler, noContent, context);
}

export function put2(context) {
	return call(putHandler, noContent, context);
}

export function delete2(context) {
	return call(deleteHandler, noContent, context);
}
```
