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
### Handler
```js
// virtual:marko-run/__marko-run__route.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,$id,$$rest,+page.marko?marko-server-entry';

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route `/foo`
### Paths
  - `/foo`
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.js
import { normalize, call, noContent, pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { GET, POST } from './src/routes/foo,(a,b).(c,d)+handler.get_post.marko';
import page from './src/routes/foo,$id,$$rest,+page.marko?marko-server-entry';

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get2(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	return call(getHandler, __page, context);
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}

export function post2(context) {
	return call(postHandler, noContent, context);
}
```
---
## Route `/$id`
### Paths
  - `/$id`
### Handler
```js
// virtual:marko-run/__marko-run__route.$id.js
import { call, pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware3 } from 'virtual:marko-run/__marko-run__middleware.js';
import page from './src/routes/foo,$id,$$rest,+page.marko?marko-server-entry';

export function get3(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	return call(mware3, __page, context);
}

export function head3(context, buildInput) {
	return stripResponseBody(get3(context, buildInput));
}
```
---
## Route `/$$rest`
### Paths
  - `/$$rest`
### Handler
```js
// virtual:marko-run/__marko-run__route.$$rest.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,$id,$$rest,+page.marko?marko-server-entry';

export function get4(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head4(context, buildInput) {
	return stripResponseBody(get4(context, buildInput));
}
```
---
## Route `/a/c`
### Paths
  - `/a/c`
### Handler
```js
// virtual:marko-run/__marko-run__route.a.c.js
import { normalize, call, noContent, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { GET, POST } from './src/routes/foo,(a,b).(c,d)+handler.get_post.marko';

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get5(context) {
	return call(getHandler, noContent, context);
}

export function head5(context) {
	return stripResponseBody(get5(context));
}

export function post5(context) {
	return call(postHandler, noContent, context);
}
```
---
## Route `/a/d`
### Paths
  - `/a/d`
### Handler
```js
// virtual:marko-run/__marko-run__route.a.d.js
import { normalize, call, noContent, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware3 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET, POST } from './src/routes/foo,(a,b).(c,d)+handler.get_post.marko';

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get6(context) {
	const __getHandler = () => call(getHandler, noContent, context);
	return call(mware3, __getHandler, context);
}

export function head6(context) {
	return stripResponseBody(get6(context));
}

export function post6(context) {
	const __postHandler = () => call(postHandler, noContent, context);
	return call(mware3, __postHandler, context);
}
```
---
## Route `/b/c`
### Paths
  - `/b/c`
### Handler
```js
// virtual:marko-run/__marko-run__route.b.c.js
import { normalize, call, noContent, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { GET, POST } from './src/routes/foo,(a,b).(c,d)+handler.get_post.marko';

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get7(context) {
	return call(getHandler, noContent, context);
}

export function head7(context) {
	return stripResponseBody(get7(context));
}

export function post7(context) {
	return call(postHandler, noContent, context);
}
```
---
## Route `/b/d`
### Paths
  - `/b/d`
### Handler
```js
// virtual:marko-run/__marko-run__route.b.d.js
import { normalize, call, noContent, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { GET, POST } from './src/routes/foo,(a,b).(c,d)+handler.get_post.marko';

const getHandler = normalize(GET);
const postHandler = normalize(POST);

export function get8(context) {
	return call(getHandler, noContent, context);
}

export function head8(context) {
	return stripResponseBody(get8(context));
}

export function post8(context) {
	return call(postHandler, noContent, context);
}
```
