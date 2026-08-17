# Routes

## Route ``faq.it's-here``
### Path: ``/faq/it's-here``
### Template
```marko
import Page from "../../src/routes/faq/it's-here/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/faq.it's-here.marko";

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
## Route ``faq.it's-here.deeper's``
### Path: ``/faq/it's-here/deeper's``
### Template
```marko
import Page from "../../src/routes/faq/it's-here/deeper's/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/faq.it's-here.deeper's.marko";

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
## Route ``faq.$``
### Path: ``/faq/$it's``
### Template
```marko
import Page from "../../src/routes/faq/$it's/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/faq.$.marko";

export const get3_options = {};
export const head3_options = {};

export function get3(context) {
	return render(context, page, {});
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
