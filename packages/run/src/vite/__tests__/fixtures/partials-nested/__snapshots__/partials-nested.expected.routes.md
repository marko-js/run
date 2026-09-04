# Routes

## Route ``docs.$``
### Path: ``/docs/$slug``
### Template
```marko
import Header3 from "../../src/routes/docs/$slug/@header.marko";
import Header2 from "../../src/routes/docs/@header.marko";
import Header1 from "../../src/routes/@header.marko";
import Layout1 from "../../src/routes/+layout.marko";
import Page from "../../src/routes/docs/$slug/+page.marko";

<Layout1>
	<@header>
		<Header3>
			<@header>
				<Header2>
					<@header>
						<Header1/>
					</>
				</>
			</>
		</>
	</>
	<Page>
		<@header>
			<Header3>
				<@header>
					<Header2>
						<@header>
							<Header1/>
						</>
					</>
				</>
			</>
		</>
	</>
</>
```
### Handler
```js
import { render, stripResponseBody } from "virtual:marko-run/runtime/internal";
import page from "./dist/.marko-run/docs.$.marko";

export const get1_options = {};
export const head1_options = {};

export function get1(context) {
	return render(context, page, {});
}

export function head1(context) {
	return stripResponseBody(get1(context));
}
```
