# Middleware
```js
// virtual:marko-run/__marko-run__middleware.js
import { normalize } from 'virtual:marko-run/internal';
import mware4 from './src/routes/+middleware.ts';
import mware5 from './src/routes/_protected/+middleware.ts';
import mware7 from './src/routes/_protected/_home/+middleware.ts';
import mware13 from './src/routes/_protected/_home/notes/$id/+middleware.ts';

export const mware$4 = normalize(mware4);
export const mware$5 = normalize(mware5);
export const mware$7 = normalize(mware7);
export const mware$13 = normalize(mware13);
```


# Route `/`
## Template
```marko
// virtual:marko-run/__marko-run__route__index.marko
import layout1 from './src/routes/+layout.marko';
import layout2 from './src/routes/_protected/_home/+layout.marko';
import page from './src/routes/_protected/_home/+page.marko';

<layout1 ...input>
	<layout2 ...input>
		<page ...input />
	</>
</>
```
## Handler
```js
// virtual:marko-run/__marko-run__route__index.js
import { call } from 'virtual:marko-run/internal';
import { mware$4, mware$5, mware$7 } from 'virtual:marko-run/__marko-run__middleware.js';
import page from 'virtual:marko-run/__marko-run__route__index.marko?marko-server-entry';

export async function get$1(context) {
	const __page = () => new Response(page.stream(context), {
		status: 200,
		headers: { "content-type": "text/html;charset=UTF-8" }
	});
	const __mware$7 = () => call(mware$7, __page, context);
	const __mware$5 = () => call(mware$5, __mware$7, context);
	return call(mware$4, __mware$5, context);
}
```


# Route `/new`
## Template
```marko
// virtual:marko-run/__marko-run__route__new.marko
import layout1 from './src/routes/+layout.marko';
import layout2 from './src/routes/_protected/_home/+layout.marko';
import page from './src/routes/_protected/_home/new/+page.marko';

<layout1 ...input>
	<layout2 ...input>
		<page ...input />
	</>
</>
```
## Handler
```js
// virtual:marko-run/__marko-run__route__new.js
import { normalize, call, noContent } from 'virtual:marko-run/internal';
import { mware$4, mware$5, mware$7 } from 'virtual:marko-run/__marko-run__middleware.js';
import { post } from './src/routes/_protected/_home/new/+handler.post.ts';
import page from 'virtual:marko-run/__marko-run__route__new.marko?marko-server-entry';
export { default as meta$2 } from './src/routes/_protected/_home/new/+meta.json';

const handler$post = normalize(post);

export async function get$2(context) {
	const __page = () => new Response(page.stream(context), {
		status: 200,
		headers: { "content-type": "text/html;charset=UTF-8" }
	});
	const __mware$7 = () => call(mware$7, __page, context);
	const __mware$5 = () => call(mware$5, __mware$7, context);
	return call(mware$4, __mware$5, context);
}

export async function post$2(context) {
	const __handler$post = () => call(handler$post, noContent, context);
	const __mware$7 = () => call(mware$7, __handler$post, context);
	const __mware$5 = () => call(mware$5, __mware$7, context);
	return call(mware$4, __mware$5, context);
}
```


# Route `/notes/$id`
## Template
```marko
// virtual:marko-run/__marko-run__route__notes__$.marko
import layout1 from './src/routes/+layout.marko';
import layout2 from './src/routes/_protected/_home/+layout.marko';
import page from './src/routes/_protected/_home/notes/$id/+page.marko';

<layout1 ...input>
	<layout2 ...input>
		<page ...input />
	</>
</>
```
## Handler
```js
// virtual:marko-run/__marko-run__route__notes__$.js
import { normalize, call, noContent } from 'virtual:marko-run/internal';
import { mware$4, mware$5, mware$7, mware$13 } from 'virtual:marko-run/__marko-run__middleware.js';
import { post } from './src/routes/_protected/_home/notes/$id/+handler.post.ts';
import page from 'virtual:marko-run/__marko-run__route__notes__$.marko?marko-server-entry';

const handler$post = normalize(post);

export async function get$3(context) {
	const __page = () => new Response(page.stream(context), {
		status: 200,
		headers: { "content-type": "text/html;charset=UTF-8" }
	});
	const __mware$13 = () => call(mware$13, __page, context);
	const __mware$7 = () => call(mware$7, __mware$13, context);
	const __mware$5 = () => call(mware$5, __mware$7, context);
	return call(mware$4, __mware$5, context);
}

export async function post$3(context) {
	const __handler$post = () => call(handler$post, noContent, context);
	const __mware$13 = () => call(mware$13, __handler$post, context);
	const __mware$7 = () => call(mware$7, __mware$13, context);
	const __mware$5 = () => call(mware$5, __mware$7, context);
	return call(mware$4, __mware$5, context);
}
```


# Route `/notes/$id/comments`
## Handler
```js
// virtual:marko-run/__marko-run__route__notes__$__comments.js
import { normalize, call, noContent } from 'virtual:marko-run/internal';
import { mware$4, mware$5, mware$7, mware$13 } from 'virtual:marko-run/__marko-run__middleware.js';
import { post } from './src/routes/_protected/_home/notes/$id/comments/+handler.post.ts';
export { default as meta$4 } from './src/routes/_protected/_home/notes/$id/comments/+meta.ts';

const handler$post = normalize(post);

export async function post$4(context) {
	const __handler$post = () => call(handler$post, noContent, context);
	const __mware$13 = () => call(mware$13, __handler$post, context);
	const __mware$7 = () => call(mware$7, __mware$13, context);
	const __mware$5 = () => call(mware$5, __mware$7, context);
	return call(mware$4, __mware$5, context);
}
```


# Route `/callback/oauth2`
## Handler
```js
// virtual:marko-run/__marko-run__route__callback__oauth2.js
import { normalize, call, noContent } from 'virtual:marko-run/internal';
import { mware$4 } from 'virtual:marko-run/__marko-run__middleware.js';
import { get } from './src/routes/callback/oauth2/+handler.get.ts';

const handler$get = normalize(get);

export async function get$5(context) {
	const __handler$get = () => call(handler$get, noContent, context);
	return call(mware$4, __handler$get, context);
}
```


# Route `/my`
## Handler
```js
// virtual:marko-run/__marko-run__route__my.js
import { normalize, call, noContent } from 'virtual:marko-run/internal';
import { mware$4 } from 'virtual:marko-run/__marko-run__middleware.js';
import { get } from './src/routes/my/+handler.get.ts';

const handler$get = normalize(get);

export async function get$6(context) {
	const __handler$get = () => call(handler$get, noContent, context);
	return call(mware$4, __handler$get, context);
}
```


# Special `404`
## Template
```marko
// virtual:marko-run/__marko-run__route__404.marko
import layout1 from './src/routes/+layout.marko';
import page from './src/routes/+404.marko';

<layout1 ...input>
	<page ...input />
</>
```


# Special `500`
## Template
```marko
// virtual:marko-run/__marko-run__route__500.marko
import layout1 from './src/routes/+layout.marko';
import page from './src/routes/+500.marko';

<layout1 ...input>
	<page ...input />
</>
```
