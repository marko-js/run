# Routes

## Route `/e.f`
### Paths
  - `/`
### Handler
```js
// virtual:marko-run/__marko-run__route.e.f.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/(`e.f`,g`.`h)/+page.marko?marko-server-entry';

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route `/a,b,c/$$id/e.html`
### Paths
  - `/a,b,c/$$id/e.html`
### Handler
```js
// virtual:marko-run/__marko-run__route.a,b,c.$$id.e.html.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/`a,b,c`/$`$`id/`e.html`/+page.marko?marko-server-entry';

export function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}
```
---
## Route `/g.h`
### Paths
  - `/g.h`
### Handler
```js
// virtual:marko-run/__marko-run__route.g.h.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/(`e.f`,g`.`h)/+page.marko?marko-server-entry';

export function get3(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head3(context, buildInput) {
	return stripResponseBody(get3(context, buildInput));
}
```
