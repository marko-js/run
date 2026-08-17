# Routes

## Route ``a%3fb.$.$``
### Path: ``/a%3fb/$`$id`/$foo``
### Template
```marko
import Page from "../../src/routes/`a?b`/$`$id`/$foo/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/a%3fb.$.$.marko";

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
## Route ``a%3fb.baz``
### Path: ``/a%3fb/baz``
### Template
```marko
import Page from "../../src/routes/`a?b`/baz/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/a%3fb.baz.marko";

export const get2_options = {};
export const head2_options = {};

export function get2(context) {
	return render(context, page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
