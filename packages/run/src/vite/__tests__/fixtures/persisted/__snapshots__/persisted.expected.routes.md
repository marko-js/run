# Routes

## Route ``index``
### Path: ``/``
### Template
```marko
client import { register as __run_persisted_register } from "virtual:marko-run/runtime/persisted";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+page.marko";

<script>
  __run_persisted_register(
    () => import("virtual:marko-run/__marko-run__routes.client.js").then((mod) => mod.default),
    2,
    $global["~run"],
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
## Route ``item.$``
### Path: ``/item/$id``
### Template
```marko
client import { register as __run_persisted_register } from "virtual:marko-run/runtime/persisted";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/item/$id/+page.marko";

<script>
  __run_persisted_register(
    () => import("virtual:marko-run/__marko-run__routes.client.js").then((mod) => mod.default),
    3,
    $global["~run"],
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
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/docs/$$rest/+page.marko";

<script>
  __run_persisted_register(
    () => import("virtual:marko-run/__marko-run__routes.client.js").then((mod) => mod.default),
    4,
    $global["~run"],
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
const r2 = [2, () => import("./dist/.marko-run/index.marko").then(() => 0), () => import("./dist/.marko-run/index.marko?update")];
const r3 = [3, () => import("./dist/.marko-run/item.$.marko").then(() => 0), () => import("./dist/.marko-run/item.$.marko?update")];
const r4 = [4, () => import("./dist/.marko-run/docs.$$.marko").then(() => 0), () => import("./dist/.marko-run/docs.$$.marko?update")];

export default function match(pathname) {
	const last = pathname.length - 1;
  if (last && pathname.charAt(last) === '/') pathname = pathname.slice(0, last);
  const len = pathname.length;
	if (len === 1) return r2;
	const i1 = pathname.indexOf('/', 1) + 1;
	if (i1 && i1 !== len) {
		switch (pathname.slice(1, i1 - 1)) {
			case 'item': {
				const i2 = pathname.indexOf('/', 6) + 1;
				if (!i2 || i2 === len) {
					const s2 = decodeURIComponent(pathname.slice(6, i2 ? -1 : len));
					if (s2) return r3;
				}
			} break;
			case 'docs': {
				return r4;
			} break;
		}
	}
	return null;
}
```
