# Routes

## Middleware
```js
import { normalize } from "virtual:marko-run/runtime/internal";
import middleware2 from "./src/routes/+middleware.ts";

export const mware2 = normalize(middleware2);
```
---

## Route ``aaa.$``
### Path: ``/aaa/$aId``
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko";

<Layout1>
	<Page/>
</>
```
### Handler
```js
import { normalize, call, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware2 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET } from "./src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.ts";
import page from "./dist/.marko-run/aaa.$.marko";

const getHandler = normalize(GET);

export function get1(context) {
	const __page = () => context.render(page, {});
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
---
## Route ``aaa.$.bbb.$``
### Path: ``/aaa/$aId/bbb/$bId``
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko";

<Layout1>
	<Page/>
</>
```
### Handler
```js
import { normalize, call, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware2 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET } from "./src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.ts";
import page from "./dist/.marko-run/aaa.$.bbb.$.marko";

const getHandler = normalize(GET);

export function get2(context) {
	const __page = () => context.render(page, {});
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
---
## Route ``aaa.$.bbb.$.ccc.$``
### Path: ``/aaa/$aId/bbb/$bId/ccc/$cId``
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko";

<Layout1>
	<Page/>
</>
```
### Handler
```js
import { normalize, call, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware2 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET } from "./src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.ts";
import page from "./dist/.marko-run/aaa.$.bbb.$.ccc.$.marko";

const getHandler = normalize(GET);

export function get3(context) {
	const __page = () => context.render(page, {});
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}

export function head3(context) {
	return stripResponseBody(get3(context));
}
```
---
## Route ``aaa.$.ccc.$``
### Path: ``/aaa/$aId/ccc/$cId``
### Template
```marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko";

<Layout1>
	<Page/>
</>
```
### Handler
```js
import { normalize, call, stripResponseBody } from "virtual:marko-run/runtime/internal";
import { mware2 } from "virtual:marko-run/__marko-run__middleware.js";
import { GET } from "./src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.ts";
import page from "./dist/.marko-run/aaa.$.ccc.$.marko";

const getHandler = normalize(GET);

export function get4(context) {
	const __page = () => context.render(page, {});
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}

export function head4(context) {
	return stripResponseBody(get4(context));
}
```
