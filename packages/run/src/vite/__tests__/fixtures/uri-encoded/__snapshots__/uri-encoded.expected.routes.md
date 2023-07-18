# Routes

## Route `/a%2Fb%2Fc/$%24id`
### Paths
  - `/a%2Fb%2Fc/$%24id`
### Template
```marko
// virtual:marko-run/__marko-run__route.a%2Fb%2Fc.$%24id.marko
import page from './src/routes/a%2Fb%2Fc/$%24id/+page.marko';

<page ...input />
```
### Handler
```js
// virtual:marko-run/__marko-run__route.a%2Fb%2Fc.$%24id.js
import { pageResponse } from 'virtual:marko-run/internal';
import page from 'virtual:marko-run/__marko-run__route.a%2Fb%2Fc.$%24id.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
