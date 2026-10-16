# Routes

## App
```marko
<!-- use tags -->

client import { patch } from "@marko/vite/patch";
client import { router } from "virtual:marko-run/runtime/patch";
import Layout0 from "../../src/routes/+layout.marko";
import Page1 from "../../src/routes/+page.marko" with { load: "render" };
import Page2 from "../../src/routes/about/+page.marko" with { load: "render" };
import Page3 from "../../src/routes/+404.marko" with { load: "render" };
import Page4 from "../../src/routes/+500.marko" with { load: "render" };
import Layout5 from "../../src/routes/blog/+layout.marko" with { load: "render" };
import Page6 from "../../src/routes/blog/+page.marko" with { load: "render" };
import Page7 from "../../src/routes/blog/$slug/+page.marko" with { load: "render" };
import Page8 from "../../src/routes/blog/tag.$$/+page.marko" with { load: "render" };
import Layout9 from "../../src/routes/admin/+layout.marko" with { load: "render" };
import Page10 from "../../src/routes/admin/users/+page.marko" with { load: "render" };

<script>router((signal, replay) => patch($global, signal, replay), /^(?:\/|\/api|\/api\/events|\/blog|\/blog\/[^/]+|\/blog\/tag(?:\/.*)?|\/about|\/admin\/users)\/?$/)</script>
<Layout0>
	<if=input.page<=0>
		<Page1/>
	</>
	<else-if=input.page<=1>
		<Page2/>
	</>
	<else-if=input.page<=2>
		<Page3/>
	</>
	<else-if=input.page<=3>
		<Page4 error=input.error/>
	</>
	<else-if=input.page<=6>
		<Layout5>
			<if=input.page<=4>
				<Page6/>
			</>
			<else-if=input.page<=5>
				<Page7/>
			</>
			<else>
				<Page8/>
			</>
		</>
	</>
	<else>
		<Layout9>
			<Page10/>
		</>
	</>
</>
```
---

## Route ``index``
### Path: ``/``
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/__marko-run__app.marko";

export const get3_options = {};
export const head3_options = {};

export function get3(context) {
	return render(context, page, { page: 0 });
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
---
## Route ``api``
### Path: ``/api``
### Handler
```js
import { normalizeHandler, call, normalizeOptions, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS, QUERY } from "./src/routes/api/+handler.ts";

const getHandler = normalizeHandler(GET, 'GET');
const headHandler = normalizeHandler(HEAD, 'HEAD');
const postHandler = normalizeHandler(POST, 'POST');
const putHandler = normalizeHandler(PUT, 'PUT');
const deleteHandler = normalizeHandler(DELETE, 'DELETE');
const patchHandler = normalizeHandler(PATCH, 'PATCH');
const optionsHandler = normalizeHandler(OPTIONS, 'OPTIONS');
const queryHandler = normalizeHandler(QUERY, 'QUERY');

export const get4_options = normalizeOptions('GET', getHandler);
export const head4_options = normalizeOptions('HEAD', headHandler);
export const post4_options = normalizeOptions('POST', postHandler);
export const put4_options = normalizeOptions('PUT', putHandler);
export const delete4_options = normalizeOptions('DELETE', deleteHandler);
export const patch4_options = normalizeOptions('PATCH', patchHandler);
export const options4_options = normalizeOptions('OPTIONS', optionsHandler);
export const query4_options = normalizeOptions('QUERY', queryHandler);

export function get4(context) {
	return call(getHandler, noContent, context);
}

export function head4(context) {
	return stripResponseBody(call(headHandler, noContent, context));
}

export function post4(context) {
	return call(postHandler, noContent, context);
}

export function put4(context) {
	return call(putHandler, noContent, context);
}

export function delete4(context) {
	return call(deleteHandler, noContent, context);
}

export function patch4(context) {
	return call(patchHandler, noContent, context);
}

export function options4(context) {
	return call(optionsHandler, noContent, context);
}

export function query4(context) {
	return call(queryHandler, noContent, context);
}
```
---
## Route ``api.events``
### Path: ``/api/events``
### Handler
```js
import { normalizeHandler, call, normalizeOptions, noContent } from "virtual:marko-run/runtime/internal";
import { POST } from "./src/routes/api/events/+handler.ts";

const postHandler = normalizeHandler(POST, 'POST');

export const post5_options = normalizeOptions('POST', postHandler);

export function post5(context) {
	return call(postHandler, noContent, context);
}
```
---
## Route ``api.items``
### Path: ``/api/items``
### Handler
```js
import { normalizeHandler, call, normalizeOptions, noContent } from "virtual:marko-run/runtime/internal";
import { PUT, DELETE } from "./src/routes/api/items/+handler.ts";

const putHandler = normalizeHandler(PUT, 'PUT');
const deleteHandler = normalizeHandler(DELETE, 'DELETE');

export const put6_options = normalizeOptions('PUT', putHandler);
export const delete6_options = normalizeOptions('DELETE', deleteHandler);

export function put6(context) {
	return call(putHandler, noContent, context);
}

export function delete6(context) {
	return call(deleteHandler, noContent, context);
}
```
---
## Route ``api.items.$``
### Path: ``/api/items/$id``
### Handler
```js
import { normalizeHandler, call, normalizeOptions, noContent } from "virtual:marko-run/runtime/internal";
import { PATCH } from "./src/routes/api/items/$id/+handler.ts";

const patchHandler = normalizeHandler(PATCH, 'PATCH');

export const patch7_options = normalizeOptions('PATCH', patchHandler);

export function patch7(context) {
	return call(patchHandler, noContent, context);
}
```
---
## Route ``blog``
### Path: ``/blog``
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/__marko-run__app.marko";

export const get8_options = {};
export const head8_options = {};

export function get8(context) {
	return render(context, page, { page: 4 });
}

export function head8(context) {
	return stripResponseBody(get8(context));
}
```
---
## Route ``blog.$``
### Path: ``/blog/$slug``
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/__marko-run__app.marko";

export const get9_options = {};
export const head9_options = {};

export function get9(context) {
	return render(context, page, { page: 5 });
}

export function head9(context) {
	return stripResponseBody(get9(context));
}
```
---
## Route ``blog.tag.$$``
### Path: ``/blog/tag/$$``
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/__marko-run__app.marko";

export const get10_options = {};
export const head10_options = {};

export function get10(context) {
	return render(context, page, { page: 6 });
}

export function head10(context) {
	return stripResponseBody(get10(context));
}
```
---
## Route ``about``
### Path: ``/about``
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/__marko-run__app.marko";

export const get11_options = {};
export const head11_options = {};

export function get11(context) {
	return render(context, page, { page: 1 });
}

export function head11(context) {
	return stripResponseBody(get11(context));
}
```
---
## Route ``admin.users``
### Path: ``/admin/users``
### Handler
```js
import { normalizeHandler, call, normalizeOptions, render, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS, QUERY } from "./src/routes/admin/users/+handler.ts";
import page from "./dist/.marko-run/__marko-run__app.marko";

const getHandler = normalizeHandler(GET, 'GET');
const headHandler = normalizeHandler(HEAD, 'HEAD');
const postHandler = normalizeHandler(POST, 'POST');
const putHandler = normalizeHandler(PUT, 'PUT');
const deleteHandler = normalizeHandler(DELETE, 'DELETE');
const patchHandler = normalizeHandler(PATCH, 'PATCH');
const optionsHandler = normalizeHandler(OPTIONS, 'OPTIONS');
const queryHandler = normalizeHandler(QUERY, 'QUERY');

export const get12_options = normalizeOptions('GET', getHandler);
export const head12_options = normalizeOptions('HEAD', headHandler);
export const post12_options = normalizeOptions('POST', postHandler);
export const put12_options = normalizeOptions('PUT', putHandler);
export const delete12_options = normalizeOptions('DELETE', deleteHandler);
export const patch12_options = normalizeOptions('PATCH', patchHandler);
export const options12_options = normalizeOptions('OPTIONS', optionsHandler);
export const query12_options = normalizeOptions('QUERY', queryHandler);

export function get12(context) {
	const __page = (data) => render(context, page, { page: 7 }, data);
	return call(getHandler, __page, context);
}

export function head12(context) {
	const __page = (data) => render(context, page, { page: 7 }, data);
	return stripResponseBody(call(headHandler, __page, context));
}

export function post12(context) {
	const __page = (data) => render(context, page, { page: 7 }, data);
	return call(postHandler, __page, context);
}

export function put12(context) {
	return call(putHandler, noContent, context);
}

export function delete12(context) {
	return call(deleteHandler, noContent, context);
}

export function patch12(context) {
	return call(patchHandler, noContent, context);
}

export function options12(context) {
	return call(optionsHandler, noContent, context);
}

export function query12(context) {
	const __page = (data) => render(context, page, { page: 7 }, data);
	return call(queryHandler, __page, context);
}
```
