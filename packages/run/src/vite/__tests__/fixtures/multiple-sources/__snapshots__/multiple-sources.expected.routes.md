# Routes

## Route `/`
### Paths
  - `/`
### Template
```marko
// virtual:marko-run/__marko-run__route.marko
import Page from './src/routes/+page.marko';

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
## Route `/%2Broutes`
### Paths
  - `/%2Broutes`
### Template
```marko
// virtual:marko-run/__marko-run__route._routes.marko
import Page from './src/routes/+page.marko';

<Page ...input/>
```
### Handler
```js
// virtual:marko-run/__marko-run__route._routes.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from 'virtual:marko-run/__marko-run__route._routes.marko?marko-server-entry';

export async function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
