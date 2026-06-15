# Routes

## Route ``index``
### Path: ``/``
### Template
```marko
<!-- use class -->

import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+page.marko";

<Layout1>
	<Page/>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/index.marko";

export const get1_options = {};
export const head1_options = {};

export function get1(context) {
	return render(context, page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
