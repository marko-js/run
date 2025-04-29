# Routes

## Route ``$/route``
### Path: ``/$campaignId``
### Handler
```js
// virtual:marko-run__marko-run__$.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$campaignId/$$rest,/+page.marko?marko-server-entry";

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route ``$/$$/route``
### Path: ``/$campaignId/$$rest``
### Handler
```js
// virtual:marko-run__marko-run__$.$$.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$campaignId/$$rest,/+page.marko?marko-server-entry";

export function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}
```
