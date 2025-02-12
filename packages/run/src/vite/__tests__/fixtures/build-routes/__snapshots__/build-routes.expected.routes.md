# Routes

## Middleware
```js
// virtual:marko-run/__marko-run__middleware.js
import { normalize } from 'virtual:marko-run/runtime/internal';
import middleware4 from './src/routes/+middleware.ts';
import middleware5 from './src/routes/_protected/+middleware.ts';
import middleware7 from './src/routes/_protected/_home/+middleware.ts';
import middleware13 from './src/routes/_protected/_home/notes/$id/+middleware.ts';

export const mware4 = normalize(middleware4);
export const mware5 = normalize(middleware5);
export const mware7 = normalize(middleware7);
export const mware13 = normalize(middleware13);
```
---

## Route `/_protected/_home`
### Paths
  - `/`
### Template
```marko
// __marko-run__route._protected._home.marko
import Layout1 from '../../../src/routes/+layout.marko';
import Layout2 from '../../../src/routes/_protected/_home/+layout.marko';
import Page from '../../../src/routes/_protected/_home/+page.marko';

<Layout1>
	<Layout2>
		<Page/>
	</>
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route._protected._home.js
import { call, pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware4, mware5, mware7 } from 'virtual:marko-run/__marko-run__middleware.js';
import page from './.marko/_protected/_home/route.marko?marko-server-entry';

export function get1(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __mware7 = () => call(mware7, __page, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route `/_protected/_home/new`
### Paths
  - `/new`
### Template
```marko
// __marko-run__route._protected._home.new.marko
import Layout1 from '../../../../src/routes/+layout.marko';
import Layout2 from '../../../../src/routes/_protected/_home/+layout.marko';
import Page from '../../../../src/routes/_protected/_home/new/+page.marko';

<Layout1>
	<Layout2>
		<Page/>
	</>
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route._protected._home.new.js
import { normalize, call, noContent, pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware4, mware5, mware7 } from 'virtual:marko-run/__marko-run__middleware.js';
import { POST } from './src/routes/_protected/_home/new/+handler.post.ts';
import page from './.marko/_protected/_home/new/route.marko?marko-server-entry';
export { default as meta2 } from './src/routes/_protected/_home/new/+meta.json';

const postHandler = normalize(POST);

export function get2(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __mware7 = () => call(mware7, __page, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}

export function post2(context) {
	const __postHandler = () => call(postHandler, noContent, context);
	const __mware7 = () => call(mware7, __postHandler, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}
```
---
## Route `/_protected/_home/notes/$id`
### Paths
  - `/notes/$id`
### Template
```marko
// __marko-run__route._protected._home.notes.$id.marko
import Layout1 from '../../../../../src/routes/+layout.marko';
import Layout2 from '../../../../../src/routes/_protected/_home/+layout.marko';
import Page from '../../../../../src/routes/_protected/_home/notes/$id/+page.marko';

<Layout1>
	<Layout2>
		<Page/>
	</>
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route._protected._home.notes.$id.js
import { normalize, call, noContent, pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware4, mware5, mware7, mware13 } from 'virtual:marko-run/__marko-run__middleware.js';
import { PUT, POST, DELETE } from './src/routes/_protected/_home/notes/$id/+handler.put_post_delete.ts';
import page from './.marko/_protected/_home/notes/$id/route.marko?marko-server-entry';

const putHandler = normalize(PUT);
const postHandler = normalize(POST);
const deleteHandler = normalize(DELETE);

export function get3(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __mware13 = () => call(mware13, __page, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function head3(context, buildInput) {
	return stripResponseBody(get3(context, buildInput));
}

export function post3(context) {
	const __postHandler = () => call(postHandler, noContent, context);
	const __mware13 = () => call(mware13, __postHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function put3(context) {
	const __putHandler = () => call(putHandler, noContent, context);
	const __mware13 = () => call(mware13, __putHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function delete3(context) {
	const __deleteHandler = () => call(deleteHandler, noContent, context);
	const __mware13 = () => call(mware13, __deleteHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}
```
---
## Route `/_protected/_home/notes/$id/comments`
### Paths
  - `/notes/$id/comments`
### Handler
```js
// virtual:marko-run/__marko-run__route._protected._home.notes.$id.comments.js
import { normalize, call, noContent } from 'virtual:marko-run/runtime/internal';
import { mware4, mware5, mware7, mware13 } from 'virtual:marko-run/__marko-run__middleware.js';
import { PUT, POST, DELETE } from './src/routes/_protected/_home/notes/$id/comments/+handler.put_post_delete.ts';
export { default as meta4 } from './src/routes/_protected/_home/notes/$id/comments/+meta.ts';

const putHandler = normalize(PUT);
const postHandler = normalize(POST);
const deleteHandler = normalize(DELETE);

export function post4(context) {
	const __postHandler = () => call(postHandler, noContent, context);
	const __mware13 = () => call(mware13, __postHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function put4(context) {
	const __putHandler = () => call(putHandler, noContent, context);
	const __mware13 = () => call(mware13, __putHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}

export function delete4(context) {
	const __deleteHandler = () => call(deleteHandler, noContent, context);
	const __mware13 = () => call(mware13, __deleteHandler, context);
	const __mware7 = () => call(mware7, __mware13, context);
	const __mware5 = () => call(mware5, __mware7, context);
	return call(mware4, __mware5, context);
}
```
---
## Route `/callback/oauth2`
### Paths
  - `/callback/oauth2`
### Handler
```js
// virtual:marko-run/__marko-run__route.callback.oauth2.js
import { normalize, call, noContent, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware4 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/callback/oauth2/+handler.get.ts';

const getHandler = normalize(GET);

export function get5(context) {
	const __getHandler = () => call(getHandler, noContent, context);
	return call(mware4, __getHandler, context);
}

export function head5(context) {
	return stripResponseBody(get5(context));
}
```
---
## Route `/my`
### Paths
  - `/my`
### Template
```marko
// __marko-run__route.my.marko
import Layout1 from '../../src/routes/+layout.marko';
import Page from '../../src/routes/my/+page.marko';

<Layout1>
	<Page/>
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.my.js
import { normalize, call, pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware4 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET, HEAD } from './src/routes/my/+handler.get_head.ts';
import page from './.marko/my/route.marko?marko-server-entry';

const getHandler = normalize(GET);
const headHandler = normalize(HEAD);

export function get6(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware4, __getHandler, context);
}

export function head6(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __headHandler = () => call(headHandler, __page, context);
	return stripResponseBody(call(mware4, __headHandler, context));
}
```
---
## Route `/$$match`
### Paths
  - `/$$match`
### Handler
```js
// virtual:marko-run/__marko-run__route.$$match.js
import { normalize, call, noContent, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware4 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/$$match/+handler.get.ts';

const getHandler = normalize(GET);

export function get7(context) {
	const __getHandler = () => call(getHandler, noContent, context);
	return call(mware4, __getHandler, context);
}

export function head7(context) {
	return stripResponseBody(get7(context));
}
```


## Special `404`
### Template
```marko
// __marko-run__special.404.marko
import Layout1 from '../src/routes/+layout.marko';
import Page from '../src/routes/+404.marko';

<Layout1>
	<Page/>
</>
```


## Special `500`
### Template
```marko
// __marko-run__special.500.marko
import Layout1 from '../src/routes/+layout.marko';
import Page from '../src/routes/+500.marko';

<Layout1>
	<Page error=input.error/>
</>
```
