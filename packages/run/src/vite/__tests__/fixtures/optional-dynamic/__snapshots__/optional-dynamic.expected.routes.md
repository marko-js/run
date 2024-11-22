# Routes

## Route `/$foo`
### Paths
  - `/$foo`
### Handler
```js
// virtual:marko-run/__marko-run__route.$foo.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/$foo/$bar`
### Paths
  - `/$foo/$bar`
### Handler
```js
// virtual:marko-run/__marko-run__route.$foo.$bar.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry';

export async function get2(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/$foo/$$rest`
### Paths
  - `/$foo/$$rest`
### Handler
```js
// virtual:marko-run/__marko-run__route.$foo.$$rest.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry';

export async function get3(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
---
## Route `/$$rest`
### Paths
  - `/$$rest`
### Handler
```js
// virtual:marko-run/__marko-run__route.$$rest.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/$foo,/$bar,$$rest/+page.marko?marko-server-entry';

export async function get4(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
