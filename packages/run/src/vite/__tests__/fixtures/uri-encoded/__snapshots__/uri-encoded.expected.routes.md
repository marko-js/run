# Route `/a%2Fb%2Fc/$%24id`
## Template
```marko
// virtual:marko-run/__marko-run__route__a2Fb2Fc__$.marko
import page from './src/routes/a%2Fb%2Fc/$%24id/+page.marko';

<page ...input />
```
## Handler
```js
// virtual:marko-run/__marko-run__route__a2Fb2Fc__$.js
import { pageResponse } from 'virtual:marko-run/internal';
import page from 'virtual:marko-run/__marko-run__route__a2Fb2Fc__$.marko?marko-server-entry';

export async function get1(context, buildInput) {
	return pageResponse(page, buildInput());
}
```
