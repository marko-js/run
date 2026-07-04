# Routes

## Route ``index``
### Path: ``/``
### Template
```marko
client import { register as __run_persisted_register } from "virtual:marko-run/runtime/persisted";
client import __run_persisted_routes from "virtual:marko-run/__marko-run__routes.client.js";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+page.marko";

<script>
  __run_persisted_register(__run_persisted_routes, "/", $global.buildHash);
</script>
<Layout1>
	<Page/>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/index.marko";

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
## Route ``item.$``
### Path: ``/item/$id``
### Template
```marko
client import { register as __run_persisted_register } from "virtual:marko-run/runtime/persisted";
client import __run_persisted_routes from "virtual:marko-run/__marko-run__routes.client.js";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/item/$id/+page.marko";

<script>
  __run_persisted_register(__run_persisted_routes, "/item/$id", $global.buildHash);
</script>
<Layout1>
	<Page/>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/item.$.marko";

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
## Route ``docs.$$``
### Path: ``/docs/$$rest``
### Template
```marko
client import { register as __run_persisted_register } from "virtual:marko-run/runtime/persisted";
client import __run_persisted_routes from "virtual:marko-run/__marko-run__routes.client.js";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/docs/$$rest/+page.marko";

<script>
  __run_persisted_register(__run_persisted_routes, "/docs/$$rest", $global.buildHash);
</script>
<Layout1>
	<Page/>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/docs.$$.marko";

export const get4_options = {};
export const head4_options = {};

export function get4(context) {
	return render(context, page, {});
}

export function head4(context) {
	return stripResponseBody(get4(context));
}
```


## Special `404`
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+404.marko";

<Layout1>
	<Page/>
</>
```


## Client route table
```js
export default [
	["/", () => import("./dist/.marko-run/index.marko"), () => import("./dist/.marko-run/index.marko?update")],
	["/item/$id", () => import("./dist/.marko-run/item.$.marko"), () => import("./dist/.marko-run/item.$.marko?update")],
	["/docs/$$rest", () => import("./dist/.marko-run/docs.$$.marko"), () => import("./dist/.marko-run/docs.$$.marko?update")],
];
```
