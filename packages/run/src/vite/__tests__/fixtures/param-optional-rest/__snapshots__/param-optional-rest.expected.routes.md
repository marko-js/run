# Routes

## Route `/$campaignId`
### Paths
  - `/$campaignId`
### Handler
```js
// virtual:marko-run/__marko-run__route.$campaignId.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$campaignId/$$rest,/+page.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/$campaignId/$$rest`
### Paths
  - `/$campaignId/$$rest`
### Handler
```js
// virtual:marko-run/__marko-run__route.$campaignId.$$rest.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$campaignId/$$rest,/+page.marko?marko-server-entry';

export async function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
