# Routes

## Route `/a%2Fb%2Fc/$%24id`
### Paths
  - `/a%2Fb%2Fc/$%24id`
### Handler
```js
// virtual:marko-run/__marko-run__route.a_b_c.$_id.js
import { pageResponse } from 'virtual:marko-run/runtime/internal';
import page from './src/routes/a%2Fb%2Fc/$%24id/+page.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
