# Routes

## Route ``docs.$``
### Path: ``/docs/$id``
### Template
```marko
import Header2 from "../../src/routes/(docs,blog)/$id/@header.marko";
import Header1 from "../../src/routes/docs/@header.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/(docs,blog)/$id/+page.marko";

<Layout1>
	<@header>
		<Header2>
			<@header>
				<Header1/>
			</>
		</>
	</>
	<Page>
		<@header>
			<Header2>
				<@header>
					<Header1/>
				</>
			</>
		</>
	</>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/docs.$.marko";

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
## Route ``blog.$``
### Path: ``/blog/$id``
### Template
```marko
import Header1 from "../../src/routes/(docs,blog)/$id/@header.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/(docs,blog)/$id/+page.marko";

<Layout1>
	<@header>
		<Header1/>
	</>
	<Page>
		<@header>
			<Header1/>
		</>
	</>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/blog.$.marko";

export const get2_options = {};
export const head2_options = {};

export function get2(context) {
	return render(context, page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
