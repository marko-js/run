# Routes

## Route `/$foo/$bar`
### Paths
  - `/$foo/$bar`
### Handler
```js
// virtual:marko-run/__marko-run__route.$foo.$bar.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry';

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route `/$foo/$$rest`
### Paths
  - `/$foo/$$rest`
### Handler
```js
// virtual:marko-run/__marko-run__route.$foo.$$rest.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry';

export function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}
```
---
## Route `/$bar`
### Paths
  - `/$bar`
### Handler
```js
// virtual:marko-run/__marko-run__route.$bar.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry';

export function get3(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head3(context, buildInput) {
	return stripResponseBody(get3(context, buildInput));
}
```
---
## Route `/$$rest`
### Paths
  - `/$$rest`
### Handler
```js
// virtual:marko-run/__marko-run__route.$$rest.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry';

export function get4(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head4(context, buildInput) {
	return stripResponseBody(get4(context, buildInput));
}
```
