# Routes

## Route ``index``
### Path: ``/``
### Template
```marko
import Page from "../../src/routes/foo,/bar,/,baz/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/index.marko";

export const get1_options = {};
export const head1_options = {};
export const query1_options = {};

export function get1(context) {
	return render(context, page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}

export function query1(context) {
	return render(context, page, {});
}
```
---
## Route ``foo``
### Path: ``/foo``
### Template
```marko
import Page from "../../src/routes/foo,/bar,/,baz/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/foo.marko";

export const get2_options = {};
export const head2_options = {};
export const query2_options = {};

export function get2(context) {
	return render(context, page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}

export function query2(context) {
	return render(context, page, {});
}
```
---
## Route ``foo.bar``
### Path: ``/foo/bar``
### Template
```marko
import Page from "../../src/routes/foo,/bar,/,baz/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/foo.bar.marko";

export const get3_options = {};
export const head3_options = {};
export const query3_options = {};

export function get3(context) {
	return render(context, page, {});
}

export function head3(context) {
	return stripResponseBody(get3(context));
}

export function query3(context) {
	return render(context, page, {});
}
```
---
## Route ``foo.bar.baz``
### Path: ``/foo/bar/baz``
### Template
```marko
import Page from "../../src/routes/foo,/bar,/,baz/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/foo.bar.baz.marko";

export const get4_options = {};
export const head4_options = {};
export const query4_options = {};

export function get4(context) {
	return render(context, page, {});
}

export function head4(context) {
	return stripResponseBody(get4(context));
}

export function query4(context) {
	return render(context, page, {});
}
```
---
## Route ``foo.baz``
### Path: ``/foo/baz``
### Template
```marko
import Page from "../../src/routes/foo,/bar,/,baz/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/foo.baz.marko";

export const get5_options = {};
export const head5_options = {};
export const query5_options = {};

export function get5(context) {
	return render(context, page, {});
}

export function head5(context) {
	return stripResponseBody(get5(context));
}

export function query5(context) {
	return render(context, page, {});
}
```
---
## Route ``bar``
### Path: ``/bar``
### Template
```marko
import Page from "../../src/routes/foo,/bar,/,baz/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/bar.marko";

export const get6_options = {};
export const head6_options = {};
export const query6_options = {};

export function get6(context) {
	return render(context, page, {});
}

export function head6(context) {
	return stripResponseBody(get6(context));
}

export function query6(context) {
	return render(context, page, {});
}
```
---
## Route ``bar.baz``
### Path: ``/bar/baz``
### Template
```marko
import Page from "../../src/routes/foo,/bar,/,baz/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/bar.baz.marko";

export const get7_options = {};
export const head7_options = {};
export const query7_options = {};

export function get7(context) {
	return render(context, page, {});
}

export function head7(context) {
	return stripResponseBody(get7(context));
}

export function query7(context) {
	return render(context, page, {});
}
```
---
## Route ``baz``
### Path: ``/baz``
### Template
```marko
import Page from "../../src/routes/foo,/bar,/,baz/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/baz.marko";

export const get8_options = {};
export const head8_options = {};
export const query8_options = {};

export function get8(context) {
	return render(context, page, {});
}

export function head8(context) {
	return stripResponseBody(get8(context));
}

export function query8(context) {
	return render(context, page, {});
}
```
