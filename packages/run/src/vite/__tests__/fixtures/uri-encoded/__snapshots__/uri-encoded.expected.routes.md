# Routes

## Route ``a%2fb%3fc%23d+e_f&g/$/route``
### Path: ``/a%2fb%3fc%23d+e:f&g/$`$id```
### Handler
```js
// virtual:marko-run__marko-run__a%2fb%3fc%23d+e_f&g.$.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/a%2Fb?c#d+e:f%26g/$%24id/+page.marko?marko-server-entry";

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
