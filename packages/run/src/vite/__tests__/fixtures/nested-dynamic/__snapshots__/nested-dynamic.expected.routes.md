# Routes

## Route `/foo/$fooId/bar/$bar Id/baz/$1bazId/$qux-Id`
### Paths
  - `/foo/$fooId/bar/$bar Id/baz/$1bazId/$qux-Id`
### Handler
```js
// virtual:marko-run/__marko-run__route.foo.$fooId.bar.$bar Id.baz.$1bazId.$qux-Id.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/foo/$fooId/bar/$bar Id/baz/$1bazId/$qux-Id/+page.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
