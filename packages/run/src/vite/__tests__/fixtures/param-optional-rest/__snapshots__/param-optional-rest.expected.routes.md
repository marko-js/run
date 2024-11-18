# Routes

## Route `/$campaignId`
### Paths
  - `/$campaignId`
### Template
```marko
// virtual:marko-run/__marko-run__route.$campaignId.marko
import Page from './src/routes/$campaignId/$$rest,/+page.marko';

<Page ...input/>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.$campaignId.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from 'virtual:marko-run/__marko-run__route.$campaignId.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/$campaignId/$$rest`
### Paths
  - `/$campaignId/$$rest`
### Template
```marko
// virtual:marko-run/__marko-run__route.$campaignId.$$rest.marko
import Page from './src/routes/$campaignId/$$rest,/+page.marko';

<Page ...input/>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.$campaignId.$$rest.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from 'virtual:marko-run/__marko-run__route.$campaignId.$$rest.marko?marko-server-entry';

export async function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
