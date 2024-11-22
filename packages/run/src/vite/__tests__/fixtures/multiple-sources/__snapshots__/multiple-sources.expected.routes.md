# Routes

## Route `/`
### Paths
  - `/`
### Handler
```js
// virtual:marko-run/__marko-run__route.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/+page.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/%2Broutes`
### Paths
  - `/%2Broutes`
### Handler
```js
// virtual:marko-run/__marko-run__route._routes.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/+page.marko?marko-server-entry';

export async function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
