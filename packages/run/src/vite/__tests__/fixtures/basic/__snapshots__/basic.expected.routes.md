# Routes

## Route `/`
### Paths
  - `/`
### Template
```marko
// virtual:marko-run/__marko-run__route.marko
import page from './src/routes/+page.marko';

<page ...input />
```
### Handler
```js
// virtual:marko-run/__marko-run__route.js
import { pageResponse } from 'virtual:marko-run/internal';
import page from 'virtual:marko-run/__marko-run__route.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
