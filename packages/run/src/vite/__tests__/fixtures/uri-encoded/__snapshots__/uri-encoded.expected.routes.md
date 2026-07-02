# Routes

## Route ``a%2fb%3fc%23d+e-f&g.$``
### Path: ``/a%2fb%3fc%23d+e:f&g/$`$id```
### Template
```marko
import Page from "../../src/routes/a%2Fb?c#d+e:f%26g/$%24id/+page.marko";

<Page/>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/a%2fb%3fc%23d+e-f&g.$.marko";

export const get1_options = {};
export const head1_options = {};

export function get1(context) {
	return render(context, page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
