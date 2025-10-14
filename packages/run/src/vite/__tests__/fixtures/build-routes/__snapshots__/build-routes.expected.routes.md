# Routes

## Middleware
```js
// virtual:marko-run/__marko-run__middleware.js
import { normalize } from "virtual:marko-run/runtime/internal";
import middleware4 from "./src/routes/+middleware.ts";
import middleware5 from "./src/routes/_protected/+middleware.ts";
import middleware7 from "./src/routes/_protected/_home/+middleware.ts";
import middleware13 from "./src/routes/_protected/_home/notes/$id/+middleware.ts";

export const mware4 = normalize(middleware4);
export const mware5 = normalize(middleware5);
export const mware7 = normalize(middleware7);
export const mware13 = normalize(middleware13);
```
---

## Route ``route``
### Path: ``/``
### Template
```marko
// ./dist/.marko-run/route.marko
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
// virtual:marko-run__marko-run__route.js
import { call, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4, mware5, mware7 } from "virtual:marko-run/__marko-run__middleware.js";
import page from "./dist/.marko-run/route.marko";

export function get3(context) {
	const __page = () => context.render(page, {});
	const __mware7 = () => call(mware7, __page, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
---
## Route ``new/route``
### Path: ``/new``
### Template
```marko
// ./dist/.marko-run/new/route.marko
import Layout1 from "../../../src/routes/+layout.marko";
import Layout2 from "../../../src/routes/_protected/_home/+layout.marko";
import Page from "../../../src/routes/_protected/_home/new/+page.marko";

<Layout1>
	<Layout2>
		<Page/>
	</>
</>
```
### Handler
```js
// virtual:marko-run__marko-run__new.route.js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4, mware5, mware7 } from "virtual:marko-run/__marko-run__middleware.js";
import { POST } from "./src/routes/_protected/_home/new/+handler.post.ts";
import page from "./dist/.marko-run/new/route.marko";
export { default as meta4 } from "./src/routes/_protected/_home/new/+meta.json";

const postHandler = normalize(POST);

export function get4(context) {
	const __page = () => context.render(page, {});
	const __mware7 = () => call(mware7, __page, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function head4(context) {
	return stripResponseBody(get4(context));
}

export function post4(context) {
	const __postHandler = () => call(postHandler, noContent, context);
	const __mware7 = () => call(mware7, __postHandler, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}
```
---
## Route ``notes/$/route``
### Path: ``/notes/$id``
### Template
```marko
// ./dist/.marko-run/notes/$/route.marko
import Layout1 from "../../../../src/routes/+layout.marko";
import Layout2 from "../../../../src/routes/_protected/_home/+layout.marko";
import Page from "../../../../src/routes/_protected/_home/notes/$id/+page.marko";

<Layout1>
	<Layout2>
		<Page/>
	</>
</>
```
### Handler
```js
// virtual:marko-run__marko-run__notes.$.route.js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4, mware5, mware7, mware13 } from "virtual:marko-run/__marko-run__middleware.js";
import { PUT, POST, DELETE } from "./src/routes/_protected/_home/notes/$id/+handler.put_post_delete.ts";
import page from "./dist/.marko-run/notes/$/route.marko";

const putHandler = normalize(PUT);
const postHandler = normalize(POST);
const deleteHandler = normalize(DELETE);

export function get5(context) {
	const __page = () => context.render(page, {});
	const __mware13 = () => call(mware13, __page, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function head5(context) {
	return stripResponseBody(get5(context));
}

export function post5(context) {
	const __postHandler = () => call(postHandler, noContent, context);
	const __mware13 = () => call(mware13, __postHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function put5(context) {
	const __putHandler = () => call(putHandler, noContent, context);
	const __mware13 = () => call(mware13, __putHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function delete5(context) {
	const __deleteHandler = () => call(deleteHandler, noContent, context);
	const __mware13 = () => call(mware13, __deleteHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}
```
---
## Route ``notes/$/comments/route``
### Path: ``/notes/$id/comments``
### Handler
```js
// virtual:marko-run__marko-run__notes.$.comments.route.js
import { normalize, call, noContent } from "virtual:marko-run/runtime/internal";
import { mware4, mware5, mware7, mware13 } from "virtual:marko-run/__marko-run__middleware.js";
import { PUT, POST, DELETE } from "./src/routes/_protected/_home/notes/$id/comments/+handler.put_post_delete.ts";
export { default as meta6 } from "./src/routes/_protected/_home/notes/$id/comments/+meta.ts";

const putHandler = normalize(PUT);
const postHandler = normalize(POST);
const deleteHandler = normalize(DELETE);

export function post6(context) {
	const __postHandler = () => call(postHandler, noContent, context);
	const __mware13 = () => call(mware13, __postHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function put6(context) {
	const __putHandler = () => call(putHandler, noContent, context);
	const __mware13 = () => call(mware13, __putHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function delete6(context) {
	const __deleteHandler = () => call(deleteHandler, noContent, context);
	const __mware13 = () => call(mware13, __deleteHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}
```
---
## Route ``callback/oauth2/route``
### Path: ``/callback/oauth2``
### Handler
```js
// virtual:marko-run__marko-run__callback.oauth2.route.js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET } from "./src/routes/callback/oauth2/+handler.get.ts";

const getHandler = normalize(GET);

export function get7(context) {
	const __getHandler = () => call(getHandler, noContent, context);
	return call(mware4, __getHandler, context);
}

export function head7(context) {
	return stripResponseBody(get7(context));
}
```
---
## Route ``my/route``
### Path: ``/my``
### Template
```marko
// ./dist/.marko-run/my/route.marko
import Layout1 from "../../../src/routes/+layout.marko";
import Page from "../../../src/routes/my/+page.marko";

<Layout1>
	<Page/>
</>
```
### Handler
```js
// virtual:marko-run__marko-run__my.route.js
import { normalize, call, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET, HEAD } from "./src/routes/my/+handler.get_head.ts";
import page from "./dist/.marko-run/my/route.marko";

const getHandler = normalize(GET);
const headHandler = normalize(HEAD);

export function get8(context) {
	const __page = () => context.render(page, {});
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware4, __getHandler, context);
}

export function head8(context) {
	const __page = () => context.render(page, {});
	const __headHandler = () => call(headHandler, __page, context);
	return stripResponseBody(call(mware4, __headHandler, context));
}
```
---
## Route ``$$/route``
### Path: ``/$$match``
### Handler
```js
// virtual:marko-run__marko-run__$$.route.js
import { normalize, call, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware4 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET } from "./src/routes/$$match/+handler.get.ts";

const getHandler = normalize(GET);

export function get9(context) {
	const __getHandler = () => call(getHandler, noContent, context);
	return call(mware4, __getHandler, context);
}

export function head9(context) {
	return stripResponseBody(get9(context));
}
```


## Special `404`
### Template
```marko
// ./dist/.marko-run/404.marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+404.marko";

<Layout1>
	<Page/>
</>
```


## Special `500`
### Template
```marko
// ./dist/.marko-run/500.marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+500.marko";

<Layout1>
	<Page error=input.error/>
</>
```
