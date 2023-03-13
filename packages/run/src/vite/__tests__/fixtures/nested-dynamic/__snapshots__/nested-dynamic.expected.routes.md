# Route `/foo/$fooid/bar/$bar id/baz/$1bazid/$qux-id`
## Template
```marko
// virtual:marko-run/__marko-run__route__foo__$__bar__$__baz__$__$.marko
import page from './src/routes/foo/$fooId/bar/$bar Id/baz/$1bazId/$qux-Id/+page.marko';

<page ...input />
```
## Handler
```js
// virtual:marko-run/__marko-run__route__foo__$__bar__$__baz__$__$.js
import { pageResponse } from 'virtual:marko-run/internal';
import page from 'virtual:marko-run/__marko-run__route__foo__$__bar__$__baz__$__$.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
