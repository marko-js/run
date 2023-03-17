# Route `/a%2fb%2fc/$%24id`
## Template
```marko
// virtual:marko-run/__marko-run__route__a2fb2fc__$.marko
import page from './src/routes/a%2Fb%2Fc/$%24id/+page.marko';

<page ...input />
```
## Handler
```js
// virtual:marko-run/__marko-run__route__a2fb2fc__$.js
import { pageResponse } from 'virtual:marko-run/internal';
import page from 'virtual:marko-run/__marko-run__route__a2fb2fc__$.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
