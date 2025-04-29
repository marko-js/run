# Routes

## Route ``a%2fb%3fc%23d+e_f&g/$/route``
### Path: ``/a%2fb%3fc%23d+e:f&g/$`$id```
### Handler
```js
// virtual:marko-run__marko-run__a%2fb%3fc%23d+e_f&g.$.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/a%2Fb?c#d+e:f%26g/$%24id/+page.marko?marko-server-entry";

export function get1(context) {
	return context.render(page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
