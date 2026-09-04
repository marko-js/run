# Routes

## Route ``index``
### Path: ``/``
### Template
```marko
import Side_bar1 from "../../src/routes/@side-bar.marko";
import Side_bar_1 from "../../src/routes/@side_bar.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/+page.marko";

<Layout1>
	<@side-bar>
		<Side_bar1/>
	</>
	<@side_bar>
		<Side_bar_1/>
	</>
	<Page>
		<@side-bar>
			<Side_bar1/>
		</>
		<@side_bar>
			<Side_bar_1/>
		</>
	</>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/index.marko";

export const get1_options = {};
export const head1_options = {};

export function get1(context) {
	return render(context, page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
