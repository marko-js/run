# Routes

## Route ``foo/$/bar/$/baz/$/$/route``
### Path: ``/foo/$fooId/bar/$bar Id/baz/$1bazId/$qux-Id``
### Handler
```js
// virtual:marko-run__marko-run__foo.$.bar.$.baz.$.$.route.js
import { pageResponse, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./src/routes/foo/$fooId/bar/$bar Id/baz/$1bazId/$qux-Id/+page.marko?marko-server-entry";

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```
