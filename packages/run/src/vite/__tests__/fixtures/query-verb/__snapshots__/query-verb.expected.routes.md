# Routes

## Route ``index``
### Path: ``/``
### Template
```marko
import Page from "../../src/routes/+page.marko";

<Page/>
```
### Handler
```js
import { normalizeHandler, call, normalizeOptions, render, noContent, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { QUERY, POST } from "./src/routes/+handler.ts";
import page from "./dist/.marko-run/index.marko";

const queryHandler = normalizeHandler(QUERY, 'QUERY');
const postHandler = normalizeHandler(POST, 'POST');

export const get1_options = {};
export const head1_options = {};
export const post1_options = normalizeOptions('POST', postHandler);
export const query1_options = normalizeOptions('QUERY', queryHandler);

export function get1(context) {
	return render(context, page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}

export function post1(context) {
	const __page = (data) => render(context, page, {}, data);
	return call(postHandler, __page, context);
}

export function query1(context) {
	return call(queryHandler, noContent, context);
}
```
