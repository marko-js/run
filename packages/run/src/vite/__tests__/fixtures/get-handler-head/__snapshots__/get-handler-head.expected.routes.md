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
import { normalizeHandler, call, normalizeOptions, render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { GET } from "./src/routes/+handler.ts";
import page from "./dist/.marko-run/index.marko";

const getHandler = normalizeHandler(GET, 'GET');

export const get1_options = normalizeOptions('GET', getHandler);
export const head1_options = normalizeOptions('HEAD', getHandler);

export function get1(context) {
	const __page = (data) => render(context, page, {}, data);
	return call(getHandler, __page, context);
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
