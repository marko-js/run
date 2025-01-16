# Routes

## Route `/$campaignId`
### Paths
  - `/$campaignId`
### Handler
```js
// virtual:marko-run/__marko-run__route.$campaignId.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$campaignId/$$rest,/+page.marko?marko-server-entry';

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route `/$campaignId/$$rest`
### Paths
  - `/$campaignId/$$rest`
### Handler
```js
// virtual:marko-run/__marko-run__route.$campaignId.$$rest.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$campaignId/$$rest,/+page.marko?marko-server-entry';

export function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}
```
