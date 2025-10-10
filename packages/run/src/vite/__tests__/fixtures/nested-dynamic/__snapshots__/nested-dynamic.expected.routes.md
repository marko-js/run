# Routes

## Route ``foo/$/bar/$/baz/$/$/route``
### Path: ``/foo/$fooId/bar/$bar Id/baz/$1bazId/$qux-Id``
### Handler
```js
// virtual:marko-run__marko-run__foo.$.bar.$.baz.$.$.route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo/$fooId/bar/$bar Id/baz/$1bazId/$qux-Id/+page.marko";

export function get1(context) {
	return context.render(page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
