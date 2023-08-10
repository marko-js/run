# Routes

## Middleware
```js
// virtual:marko-run/__marko-run__middleware.js
import { normalize } from 'virtual:marko-run/internal';
import middleware2 from './src/routes/+middleware.ts';

export const mware2 = normalize(middleware2);
```
---

## Route `/aaa/$aId`
### Paths
  - `/aaa/$aId`
### Template
```marko
// virtual:marko-run/__marko-run__route.aaa.$aId.marko
import layout1 from './src/routes/+layout.marko';
import page from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko';

<layout1 ...input>
	<page ...input />
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.aaa.$aId.js
import { normalize, call, pageResponse } from 'virtual:marko-run/internal';
import { mware2 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.get.ts';
import page from 'virtual:marko-run/__marko-run__route.aaa.$aId.marko?marko-server-entry';

const getHandler = normalize(GET);

export async function get1(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}
```
---
## Route `/aaa/$aId/bbb/$bId`
### Paths
  - `/aaa/$aId/bbb/$bId`
### Template
```marko
// virtual:marko-run/__marko-run__route.aaa.$aId.bbb.$bId.marko
import layout1 from './src/routes/+layout.marko';
import page from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko';

<layout1 ...input>
	<page ...input />
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.aaa.$aId.bbb.$bId.js
import { normalize, call, pageResponse } from 'virtual:marko-run/internal';
import { mware2 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.get.ts';
import page from 'virtual:marko-run/__marko-run__route.aaa.$aId.bbb.$bId.marko?marko-server-entry';

const getHandler = normalize(GET);

export async function get2(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}
```
---
## Route `/aaa/$aId/bbb/$bId/ccc/$cId`
### Paths
  - `/aaa/$aId/bbb/$bId/ccc/$cId`
### Template
```marko
// virtual:marko-run/__marko-run__route.aaa.$aId.bbb.$bId.ccc.$cId.marko
import layout1 from './src/routes/+layout.marko';
import page from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko';

<layout1 ...input>
	<page ...input />
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.aaa.$aId.bbb.$bId.ccc.$cId.js
import { normalize, call, pageResponse } from 'virtual:marko-run/internal';
import { mware2 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.get.ts';
import page from 'virtual:marko-run/__marko-run__route.aaa.$aId.bbb.$bId.ccc.$cId.marko?marko-server-entry';

const getHandler = normalize(GET);

export async function get3(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}
```
---
## Route `/aaa/$aId/ccc/$cId`
### Paths
  - `/aaa/$aId/ccc/$cId`
### Template
```marko
// virtual:marko-run/__marko-run__route.aaa.$aId.ccc.$cId.marko
import layout1 from './src/routes/+layout.marko';
import page from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+page.marko';

<layout1 ...input>
	<page ...input />
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.aaa.$aId.ccc.$cId.js
import { normalize, call, pageResponse } from 'virtual:marko-run/internal';
import { mware2 } from 'virtual:marko-run/__marko-run__middleware.js';
import { GET } from './src/routes/aaa.$aId.(,bbb.$bId).(,ccc.$cId)/+handler.get.ts';
import page from 'virtual:marko-run/__marko-run__route.aaa.$aId.ccc.$cId.marko?marko-server-entry';

const getHandler = normalize(GET);

export async function get4(context, buildInput) {
	const __page = () => pageResponse(page, buildInput());
	const __getHandler = () => call(getHandler, __page, context);
	return call(mware2, __getHandler, context);
}
```
