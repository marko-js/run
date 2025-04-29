# Routes

## Route ``$/route``
### Path: ``/$campaignId``
### Handler
```js
// virtual:marko-run__marko-run__$.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$campaignId/$$rest,/+page.marko?marko-server-entry";

export function get1(context) {
	return context.render(page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
---
## Route ``$/$$/route``
### Path: ``/$campaignId/$$rest``
### Handler
```js
// virtual:marko-run__marko-run__$.$$.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/$campaignId/$$rest,/+page.marko?marko-server-entry";

export function get2(context) {
	return context.render(page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```
