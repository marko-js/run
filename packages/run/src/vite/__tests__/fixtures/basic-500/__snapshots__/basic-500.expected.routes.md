# Routes

## Route `/`
### Paths
  - `/`
### Template
```marko
// __marko-run__route.marko
import Layout1 from '../src/routes/+layout.marko';
import Page from '../src/routes/+page.marko';

<Layout1>
	<Page/>
</>
```
### Handler
```js
// virtual:marko-run/__marko-run__route.js
import { pageResponse, stripResponseBody } from 'virtual:marko-run/runtime/internal';
import page from './.marko/route.marko?marko-server-entry';

export function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}

export function head1(context, buildInput) {
	return stripResponseBody(get1(context, buildInput));
}
```


## Special `500`
### Template
```marko
// __marko-run__special.500.marko
import Layout1 from '../src/routes/+layout.marko';
import Page from '../src/routes/+500.marko';

<Layout1>
	<Page error=input.error/>
</>
```
