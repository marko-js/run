# Routes

## Route `/`
### Paths
  - `/`
### Handler
```js
// virtual:marko-run/__marko-run__route.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/foo`
### Paths
  - `/foo`
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export async function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/foo/bar`
### Paths
  - `/foo/bar`
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.bar.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export async function get3(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/foo/bar/baz`
### Paths
  - `/foo/bar/baz`
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.bar.baz.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export async function get4(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/foo/baz`
### Paths
  - `/foo/baz`
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.baz.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export async function get5(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/bar`
### Paths
  - `/bar`
### Handler
```js
// virtual:marko-run/__marko-run__route.bar.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export async function get6(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/bar/baz`
### Paths
  - `/bar/baz`
### Handler
```js
// virtual:marko-run/__marko-run__route.bar.baz.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export async function get7(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/baz`
### Paths
  - `/baz`
### Handler
```js
// virtual:marko-run/__marko-run__route.baz.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo,/bar,/,baz/+page.marko?marko-server-entry';

export async function get8(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
