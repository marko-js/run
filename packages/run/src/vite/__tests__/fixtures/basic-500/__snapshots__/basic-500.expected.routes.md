# Routes

## Route ``route``
### Path: ``/``
### Template
```marko
// ./dist/.marko-run/route.marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+page.marko";

<Layout1>
	<Page/>
</>
```
### Handler
```js
// virtual:marko-run__marko-run__route.js
import { stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/route.marko?marko-server-entry";

export function get2(context) {
	return context.render(page, {});
}

export function head2(context) {
	return stripResponseBody(get2(context));
}
```


## Special `500`
### Template
```marko
// ./dist/.marko-run/500.marko
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+500.marko";

<Layout1>
	<Page error=input.error/>
</>
```
