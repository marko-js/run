# Routes

## Route `/$foo,_,$$rest/_,$bar/,$baz,`
### Paths
  - `/`
  - `/$foo`
  - `/$$rest`
  - `/$foo/$bar`
  - `/$foo/$bar/$baz`
### Template
```marko
// virtual:marko-run/__marko-run__route.$foo,_,$$rest._,$bar.,$baz,.marko
import page from './src/routes/$foo,_,$$rest/_,$bar/,$baz,/+page.marko';

<page ...input />
```
### Handler
```js
// virtual:marko-run/__marko-run__route.$foo,_,$$rest._,$bar.,$baz,.js
import { pageResponse } from 'virtual:marko-run/internal';
import page from 'virtual:marko-run/__marko-run__route.$foo,_,$$rest._,$bar.,$baz,.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
