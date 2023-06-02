# Routes

## Route `/foo,_/_,bar/,baz,`
### Paths
  - `/`
  - `/foo`
  - `/bar`
  - `/foo/bar`
  - `/baz`
  - `/foo/baz`
  - `/bar/baz`
  - `/foo/bar/baz`
### Template
```marko
// virtual:marko-run/__marko-run__route.foo,_._,bar.,baz,.marko
import page from './src/routes/foo,_/_,bar/,baz,/+page.marko';

<page ...input />
```
### Handler
```js
// virtual:marko-run/__marko-run__route.foo,_._,bar.,baz,.js
import { pageResponse } from 'virtual:marko-run/internal';
import page from 'virtual:marko-run/__marko-run__route.foo,_._,bar.,baz,.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
