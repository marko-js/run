# Routes

## Route `/`
### Paths
  - `/`
### Handler
```js
// virtual:marko-run/__marko-run__route.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/+page.marko?marko-server-entry';

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route `/fOoBaR`
### Paths
  - `/fOoBaR`
### Handler
```js
// virtual:marko-run/__marko-run__route.fOoBaR.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/fOoBaR/+page.marko?marko-server-entry';

export function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}
```
