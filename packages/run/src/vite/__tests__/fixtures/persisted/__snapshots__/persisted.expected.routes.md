# Routes

## Route ``index``
### Path: ``/``
### Template
```marko
client import { register as __run_persisted_register } from "virtual:marko-run/runtime/persisted";
client import __run_persisted_matcher from "virtual:marko-run/__marko-run__routes.client.js";
client import { buildId as __run_persisted_build_id } from "virtual:marko-vite/link-assets";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+page.marko";

<script>
  __run_persisted_register(
    __run_persisted_matcher,
    2,
    __run_persisted_build_id(),
  );
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
## Route ``item.new``
### Path: ``/item/new``
### Template
```marko
client import { register as __run_persisted_register } from "virtual:marko-run/runtime/persisted";
client import __run_persisted_matcher from "virtual:marko-run/__marko-run__routes.client.js";
client import { buildId as __run_persisted_build_id } from "virtual:marko-vite/link-assets";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/item/new/+page.marko";

<script>
  __run_persisted_register(
    __run_persisted_matcher,
    3,
    __run_persisted_build_id(),
  );
</script>
<Layout1>
	<Page/>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/item.new.marko";

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
## Route ``item.$``
### Path: ``/item/$id``
### Template
```marko
client import { register as __run_persisted_register } from "virtual:marko-run/runtime/persisted";
client import __run_persisted_matcher from "virtual:marko-run/__marko-run__routes.client.js";
client import { buildId as __run_persisted_build_id } from "virtual:marko-vite/link-assets";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/item/$id/+page.marko";

<script>
  __run_persisted_register(
    __run_persisted_matcher,
    4,
    __run_persisted_build_id(),
  );
</script>
<Layout1>
	<Page/>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/item.$.marko";

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
## Route ``docs.intro``
### Path: ``/docs/intro``
### Template
```marko
client import { register as __run_persisted_register } from "virtual:marko-run/runtime/persisted";
client import __run_persisted_matcher from "virtual:marko-run/__marko-run__routes.client.js";
client import { buildId as __run_persisted_build_id } from "virtual:marko-vite/link-assets";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/docs/intro/+page.marko";

<script>
  __run_persisted_register(
    __run_persisted_matcher,
    5,
    __run_persisted_build_id(),
  );
</script>
<Layout1>
	<Page/>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/docs.intro.marko";

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
## Route ``docs.$$``
### Path: ``/docs/$$rest``
### Template
```marko
client import { register as __run_persisted_register } from "virtual:marko-run/runtime/persisted";
client import __run_persisted_matcher from "virtual:marko-run/__marko-run__routes.client.js";
client import { buildId as __run_persisted_build_id } from "virtual:marko-vite/link-assets";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/docs/$$rest/+page.marko";

<script>
  __run_persisted_register(
    __run_persisted_matcher,
    6,
    __run_persisted_build_id(),
  );
</script>
<Layout1>
	<Page/>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/docs.$$.marko";

export const get6_options = {};
export const head6_options = {};

export function get6(context) {
	return render(context, page, {});
}

export function head6(context) {
	return stripResponseBody(get6(context));
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
const routes = [
	[2, () => import("./dist/.marko-run/index.marko?persisted"), /^\/$/],
	[3, () => import("./dist/.marko-run/item.new.marko?persisted"), /^\/item\/new\/?$/],
	[5, () => import("./dist/.marko-run/docs.intro.marko?persisted"), /^\/docs\/intro\/?$/],
	[4, () => import("./dist/.marko-run/item.$.marko?persisted"), /^\/item\/[^/]+\/?$/],
	[6, () => import("./dist/.marko-run/docs.$$.marko?persisted"), /^\/docs\/.+\/?$/],
];
export default (pathname) => routes.find((route) => route[2].test(pathname));
```
