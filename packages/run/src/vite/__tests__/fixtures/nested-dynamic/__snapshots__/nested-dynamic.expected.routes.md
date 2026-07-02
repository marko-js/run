# Routes

## Route ``foo.$.bar.$.baz.$.$``
### Path: ``/foo/$fooId/bar/$bar_Id/baz/$1bazId/$qux-Id``
### Template
```marko
import Page from "../../src/routes/foo/$fooId/bar/$bar_Id/baz/$1bazId/$qux-Id/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/foo.$.bar.$.baz.$.$.marko";

export const get1_options = {};
export const head1_options = {};

export function get1(context) {
	return render(context, page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
