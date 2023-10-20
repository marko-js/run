# Routes

## Route `/`
### Paths
  - `/`
### Template
```marko
// virtual:marko-run/__marko-run__route.marko
import page from './src/routes/+page.marko';

<page ...input/>
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
## Route `/fOoBaR`
### Paths
  - `/fOoBaR`
### Template
```marko
// virtual:marko-run/__marko-run__route.fOoBaR.marko
import page from './src/routes/fOoBaR/+page.marko';

<page ...input/>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.fOoBaR.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from 'virtual:marko-run/__marko-run__route.fOoBaR.marko?marko-server-entry';

export async function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
