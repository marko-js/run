# Routes

## Middleware
```js
// virtual:marko-run/__marko-run__middleware.js
import { normalize } from 'virtual:marko-run/runtime/internal';
import middleware3 from './src/routes/$id,a.d+middleware.marko';

export const mware3 = normalize(middleware3);
```
---

## Route `/`
### Paths
  - `/`
### Template
```marko
// virtual:marko-run/__marko-run__route.marko
import Page from './src/routes/foo,$id,$$rest,+page.marko';

<Page ...input/>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from 'virtual:marko-run/__marko-run__route.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/foo`
### Paths
  - `/foo`
### Template
```marko
// virtual:marko-run/__marko-run__route.foo.marko
import Page from './src/routes/foo,$id,$$rest,+page.marko';

<Page ...input/>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.js
import { normalize, call, pageResponse } from 'virtual:marko-run/runtime/internal';
import { GET } from './src/routes/foo,(a,b).(c,d)+handler.get.marko';
import page from 'virtual:marko-run/__marko-run__route.foo.marko?marko-server-entry';

const getHandler = normalize(GET);

export async function get2(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	return call(getHandler, __page, context);
}
```
---
## Route `/$id`
### Paths
  - `/$id`
### Template
```marko
// virtual:marko-run/__marko-run__route.$id.marko
import Page from './src/routes/foo,$id,$$rest,+page.marko';

<Page ...input/>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.$id.js
import { call, pageResponse } from 'virtual:marko-run/runtime/internal';
import { mware3 } from 'virtual:marko-run/__marko-run__middleware.js';
import page from 'virtual:marko-run/__marko-run__route.$id.marko?marko-server-entry';

export async function get3(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	return call(mware3, __page, context);
}
```
---
## Route `/$$rest`
### Paths
  - `/$$rest`
### Template
```marko
// virtual:marko-run/__marko-run__route.$$rest.marko
import Page from './src/routes/foo,$id,$$rest,+page.marko';

<Page ...input/>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.$$rest.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from 'virtual:marko-run/__marko-run__route.$$rest.marko?marko-server-entry';

export async function get4(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/a/c`
### Paths
  - `/a/c`
### Handler
```js
// virtual:marko-run/__marko-run__route.a.c.js
import { normalize, call, noContent } from 'virtual:marko-run/runtime/internal';
import { GET } from './src/routes/foo,(a,b).(c,d)+handler.get.marko';

const getHandler = normalize(GET);

export async function get5(context) {
	return call(getHandler, noContent, context);
}
```
---
## Route `/a/d`
### Paths
  - `/a/d`
### Handler
```js
// virtual:marko-run/__marko-run__route.a.d.js
import { normalize, call, noContent } from 'virtual:marko-run/runtime/internal';
import { mware3 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/foo,(a,b).(c,d)+handler.get.marko';

const getHandler = normalize(GET);

export async function get6(context) {
	const __getHandler = () => call(getHandler, noContent, context);
	return call(mware3, __getHandler, context);
}
```
---
## Route `/b/c`
### Paths
  - `/b/c`
### Handler
```js
// virtual:marko-run/__marko-run__route.b.c.js
import { normalize, call, noContent } from 'virtual:marko-run/runtime/internal';
import { GET } from './src/routes/foo,(a,b).(c,d)+handler.get.marko';

const getHandler = normalize(GET);

export async function get7(context) {
	return call(getHandler, noContent, context);
}
```
---
## Route `/b/d`
### Paths
  - `/b/d`
### Handler
```js
// virtual:marko-run/__marko-run__route.b.d.js
import { normalize, call, noContent } from 'virtual:marko-run/runtime/internal';
import { GET } from './src/routes/foo,(a,b).(c,d)+handler.get.marko';

const getHandler = normalize(GET);

export async function get8(context) {
	return call(getHandler, noContent, context);
}
```
