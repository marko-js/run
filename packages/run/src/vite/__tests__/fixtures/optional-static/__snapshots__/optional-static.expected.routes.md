# Routes

## Route `/`
### Paths
  - `/`
### Handler
```js
// virtual:marko-run/__marko-run__route.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
---
## Route `/foo`
### Paths
  - `/foo`
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head2(context, buildInput) {
	return stripResponseBody(get2(context, buildInput));
}
```
---
## Route `/foo/bar`
### Paths
  - `/foo/bar`
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.bar.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export function get3(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head3(context, buildInput) {
	return stripResponseBody(get3(context, buildInput));
}
```
---
## Route `/foo/bar/baz`
### Paths
  - `/foo/bar/baz`
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.bar.baz.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export function get4(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head4(context, buildInput) {
	return stripResponseBody(get4(context, buildInput));
}
```
---
## Route `/foo/baz`
### Paths
  - `/foo/baz`
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.baz.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export function get5(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head5(context, buildInput) {
	return stripResponseBody(get5(context, buildInput));
}
```
---
## Route `/bar`
### Paths
  - `/bar`
### Handler
```js
// virtual:marko-run/__marko-run__route.bar.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export function get6(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head6(context, buildInput) {
	return stripResponseBody(get6(context, buildInput));
}
```
---
## Route `/bar/baz`
### Paths
  - `/bar/baz`
### Handler
```js
// virtual:marko-run/__marko-run__route.bar.baz.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export function get7(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head7(context, buildInput) {
	return stripResponseBody(get7(context, buildInput));
}
```
---
## Route `/baz`
### Paths
  - `/baz`
### Handler
```js
// virtual:marko-run/__marko-run__route.baz.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export function get8(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head8(context, buildInput) {
	return stripResponseBody(get8(context, buildInput));
}
```
