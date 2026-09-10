# Routes

## Route ``index``
### Path: ``/``
### Template
```marko
import Header1 from "../../src/routes/@header.marko";
import Footer1 from "../../src/routes/@footer.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+page.marko";

<Layout1>
	<@header>
		<Header1/>
	</>
	<@footer>
		<Footer1/>
	</>
	<Page>
		<@header>
			<Header1/>
		</>
		<@footer>
			<Footer1/>
		</>
	</>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/index.marko";

export const get3_options = {};
export const head3_options = {};

export function get3(context) {
	return render(context, page, {});
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
---
## Route ``a``
### Path: ``/a``
### Template
```marko
import Header1 from "../../src/routes/@header.marko";
import Footer1 from "../../src/routes/@footer.marko";
import Nav1 from "../../src/routes/(a,b)@nav.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/a+page.marko";

<Layout1>
	<@header>
		<Header1/>
	</>
	<@footer>
		<Footer1/>
	</>
	<@nav>
		<Nav1/>
	</>
	<Page>
		<@header>
			<Header1/>
		</>
		<@footer>
			<Footer1/>
		</>
		<@nav>
			<Nav1/>
		</>
	</>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/a.marko";

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
## Route ``b``
### Path: ``/b``
### Template
```marko
import Header1 from "../../src/routes/@header.marko";
import Footer1 from "../../src/routes/@footer.marko";
import Nav1 from "../../src/routes/(a,b)@nav.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/b+page.marko";

<Layout1>
	<@header>
		<Header1/>
	</>
	<@footer>
		<Footer1/>
	</>
	<@nav>
		<Nav1/>
	</>
	<Page>
		<@header>
			<Header1/>
		</>
		<@footer>
			<Footer1/>
		</>
		<@nav>
			<Nav1/>
		</>
	</>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/b.marko";

export const get5_options = {};
export const head5_options = {};

export function get5(context) {
	return render(context, page, {});
}

export function head5(context) {
	return stripResponseBody(get5(context));
}
```
---
## Route ``flat.page``
### Path: ``/flat/page``
### Template
```marko
import Header2 from "../../src/routes/flat.page@header.marko";
import Header1 from "../../src/routes/@header.marko";
import Footer1 from "../../src/routes/@footer.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/flat.page+page.marko";

<Layout1>
	<@header>
		<Header2>
			<@header>
				<Header1/>
			</>
		</>
	</>
	<@footer>
		<Footer1/>
	</>
	<Page>
		<@header>
			<Header2>
				<@header>
					<Header1/>
				</>
			</>
		</>
		<@footer>
			<Footer1/>
		</>
	</>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/flat.page.marko";

export const get6_options = {};
export const head6_options = {};

export function get6(context) {
	return render(context, page, {});
}

export function head6(context) {
	return stripResponseBody(get6(context));
}
```
---
## Route ``docs``
### Path: ``/docs``
### Template
```marko
import Header2 from "../../src/routes/docs/@header.marko";
import Header1 from "../../src/routes/@header.marko";
import Footer1 from "../../src/routes/@footer.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Layout2 from "../../src/routes/docs/+layout.marko";
import Page from "../../src/routes/docs/+page.marko";

<Layout1>
	<@header>
		<Header2>
			<@header>
				<Header1/>
			</>
		</>
	</>
	<@footer>
		<Footer1/>
	</>
	<Layout2>
		<@header>
			<Header2>
				<@header>
					<Header1/>
				</>
			</>
		</>
		<@footer>
			<Footer1/>
		</>
		<Page>
			<@header>
				<Header2>
					<@header>
						<Header1/>
					</>
				</>
			</>
			<@footer>
				<Footer1/>
			</>
		</>
	</>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/docs.marko";

export const get7_options = {};
export const head7_options = {};

export function get7(context) {
	return render(context, page, {});
}

export function head7(context) {
	return stripResponseBody(get7(context));
}
```
---
## Route ``docs.$``
### Path: ``/docs/$slug``
### Template
```marko
import Header3 from "../../src/routes/docs/$slug/@header.marko";
import Header2 from "../../src/routes/docs/@header.marko";
import Header1 from "../../src/routes/@header.marko";
import Footer1 from "../../src/routes/@footer.marko";
import Sidebar1 from "../../src/routes/docs/$slug/@sidebar.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Layout2 from "../../src/routes/docs/+layout.marko";
import Page from "../../src/routes/docs/$slug/+page.marko";

<Layout1>
	<@header>
		<Header3>
			<@header>
				<Header2>
					<@header>
						<Header1/>
					</>
				</>
			</>
		</>
	</>
	<@footer>
		<Footer1/>
	</>
	<@sidebar>
		<Sidebar1/>
	</>
	<Layout2>
		<@header>
			<Header3>
				<@header>
					<Header2>
						<@header>
							<Header1/>
						</>
					</>
				</>
			</>
		</>
		<@footer>
			<Footer1/>
		</>
		<@sidebar>
			<Sidebar1/>
		</>
		<Page>
			<@header>
				<Header3>
					<@header>
						<Header2>
							<@header>
								<Header1/>
							</>
						</>
					</>
				</>
			</>
			<@footer>
				<Footer1/>
			</>
			<@sidebar>
				<Sidebar1/>
			</>
		</>
	</>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/docs.$.marko";

export const get8_options = {};
export const head8_options = {};

export function get8(context) {
	return render(context, page, {});
}

export function head8(context) {
	return stripResponseBody(get8(context));
}
```
---
## Route ``blog``
### Path: ``/blog``
### Template
```marko
import Header1 from "../../src/routes/@header.marko";
import Footer1 from "../../src/routes/@footer.marko";
import Sidebar1 from "../../src/routes/blog/@sidebar.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/blog/+page.marko";

<Layout1>
	<@header>
		<Header1/>
	</>
	<@footer>
		<Footer1/>
	</>
	<@sidebar>
		<Sidebar1/>
	</>
	<Page>
		<@header>
			<Header1/>
		</>
		<@footer>
			<Footer1/>
		</>
		<@sidebar>
			<Sidebar1/>
		</>
	</>
</>
```
### Handler
```js
import { normalizeHandler, call, normalizeOptions, render, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS, QUERY } from "./src/routes/blog/+handler.ts";
import page from "./dist/.marko-run/blog.marko";

const getHandler = normalizeHandler(GET, 'GET');
const headHandler = normalizeHandler(HEAD, 'HEAD');
const postHandler = normalizeHandler(POST, 'POST');
const putHandler = normalizeHandler(PUT, 'PUT');
const deleteHandler = normalizeHandler(DELETE, 'DELETE');
const patchHandler = normalizeHandler(PATCH, 'PATCH');
const optionsHandler = normalizeHandler(OPTIONS, 'OPTIONS');
const queryHandler = normalizeHandler(QUERY, 'QUERY');

export const get9_options = normalizeOptions('GET', getHandler);
export const head9_options = normalizeOptions('HEAD', headHandler);
export const post9_options = normalizeOptions('POST', postHandler);
export const put9_options = normalizeOptions('PUT', putHandler);
export const delete9_options = normalizeOptions('DELETE', deleteHandler);
export const patch9_options = normalizeOptions('PATCH', patchHandler);
export const options9_options = normalizeOptions('OPTIONS', optionsHandler);
export const query9_options = normalizeOptions('QUERY', queryHandler);

export function get9(context) {
	const __page = (data) => render(context, page, {}, data);
	return call(getHandler, __page, context);
}

export function head9(context) {
	const __page = (data) => render(context, page, {}, data);
	return stripResponseBody(call(headHandler, __page, context));
}

export function post9(context) {
	const __page = (data) => render(context, page, {}, data);
	return call(postHandler, __page, context);
}

export function put9(context) {
	return call(putHandler, noContent, context);
}

export function delete9(context) {
	return call(deleteHandler, noContent, context);
}

export function patch9(context) {
	return call(patchHandler, noContent, context);
}

export function options9(context) {
	return call(optionsHandler, noContent, context);
}

export function query9(context) {
	const __page = (data) => render(context, page, {}, data);
	return call(queryHandler, __page, context);
}
```


## Special `404`
### Template
```marko
import Header1 from "../../src/routes/@header.marko";
import Footer1 from "../../src/routes/@footer.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+404.marko";

<Layout1>
	<@header>
		<Header1/>
	</>
	<@footer>
		<Footer1/>
	</>
	<Page>
		<@header>
			<Header1/>
		</>
		<@footer>
			<Footer1/>
		</>
	</>
</>
```


## Special `500`
### Template
```marko
import Header1 from "../../src/routes/@header.marko";
import Footer1 from "../../src/routes/@footer.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+500.marko";

<Layout1>
	<@header>
		<Header1/>
	</>
	<@footer>
		<Footer1/>
	</>
	<Page error=input.error>
		<@header>
			<Header1/>
		</>
		<@footer>
			<Footer1/>
		</>
	</>
</>
```
