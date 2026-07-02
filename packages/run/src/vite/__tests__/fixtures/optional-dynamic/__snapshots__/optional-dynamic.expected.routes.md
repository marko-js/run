# Routes

## Route ``$.$``
### Path: ``/$foo/$bar``
### Template
```marko
import Page from "../../src/routes/$foo,/$bar,$$rest/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/$.$.marko";

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
## Route ``$.$$``
### Path: ``/$foo/$$rest``
### Template
```marko
import Page from "../../src/routes/$foo,/$bar,$$rest/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/$.$$.marko";

export const get2_options = {};
export const head2_options = {};

export function get2(context) {
	return render(context, page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
---
## Route ``$``
### Path: ``/$bar``
### Template
```marko
import Page from "../../src/routes/$foo,/$bar,$$rest/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/$.marko";

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
## Route ``$$``
### Path: ``/$$rest``
### Template
```marko
import Page from "../../src/routes/$foo,/$bar,$$rest/+page.marko";

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
