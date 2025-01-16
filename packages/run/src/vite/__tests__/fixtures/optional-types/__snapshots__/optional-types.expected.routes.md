# Routes

## Middleware
```js
// virtual:marko-run/__marko-run__middleware.js
import { normalize } from 'virtual:marko-run/runtime/internal';
import middleware2 from './src/routes/+middleware.ts';

export const mware2 = normalize(middleware2);
```
---

## Route `/aaa/$aId`
### Paths
  - `/aaa/$aId`
### Template
```marko
// __marko-run__route.aaa.$aId.marko
import Layout1 from '../../src/routes/+layout.marko';
import Page from '../../src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko';

<Layout1>
	<Page/>
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.aaa.$aId.js
import { normalize, call, pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware2 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.get.ts';
import page from './.marko/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/route.marko?marko-server-entry';

const getHandler = normalize(GET);

export function get1(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route `/aaa/$aId/bbb/$bId`
### Paths
  - `/aaa/$aId/bbb/$bId`
### Template
```marko
// __marko-run__route.aaa.$aId.bbb.$bId.marko
import Layout1 from '../../src/routes/+layout.marko';
import Page from '../../src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko';

<Layout1>
	<Page/>
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.aaa.$aId.bbb.$bId.js
import { normalize, call, pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware2 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.get.ts';
import page from './.marko/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/route.marko?marko-server-entry';

const getHandler = normalize(GET);

export function get2(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}
```
---
## Route `/aaa/$aId/bbb/$bId/ccc/$cId`
### Paths
  - `/aaa/$aId/bbb/$bId/ccc/$cId`
### Template
```marko
// __marko-run__route.aaa.$aId.bbb.$bId.ccc.$cId.marko
import Layout1 from '../../src/routes/+layout.marko';
import Page from '../../src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko';

<Layout1>
	<Page/>
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.aaa.$aId.bbb.$bId.ccc.$cId.js
import { normalize, call, pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware2 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.get.ts';
import page from './.marko/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/route.marko?marko-server-entry';

const getHandler = normalize(GET);

export function get3(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}

export function head3(context, buildInput) {
	return stripResponseBody(get3(context, buildInput));
}
```
---
## Route `/aaa/$aId/ccc/$cId`
### Paths
  - `/aaa/$aId/ccc/$cId`
### Template
```marko
// __marko-run__route.aaa.$aId.ccc.$cId.marko
import Layout1 from '../../src/routes/+layout.marko';
import Page from '../../src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko';

<Layout1>
	<Page/>
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.aaa.$aId.ccc.$cId.js
import { normalize, call, pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import { mware2 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.get.ts';
import page from './.marko/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/route.marko?marko-server-entry';

const getHandler = normalize(GET);

export function get4(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}

export function head4(context, buildInput) {
	return stripResponseBody(get4(context, buildInput));
}
```
