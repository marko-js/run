# Route `/`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__index.marko
import layout1 from './src/routes/(home)/+layout.marko';
import page from './src/routes/(home)/+page.marko';

<layout1 ...input>
	<page ...input />
</>
```
## Handler
```js
// virtual:marko-serve/__marko-serve__route__index.js
import middleware$1 from './src/routes/+middleware.ts';
import { get as handler$get, put as handler$put, post as handler$post, del as handler$delete } from './src/routes/(home)/+handler.get_put_post_delete.ts';
import page from 'virtual:marko-serve/__marko-serve__route__index.marko?marko-server-entry';
export { default as meta$1 } from './src/routes/(home)/+meta.json';

function create204Response() {
	return new Response(null, {
		status: 204
	})
}

export async function get$1(ctx) {
	async function createPageResponse() {
		return new Response(page.stream(ctx), {
			status: 200,
			headers: { "content-type": "text/html;charset=UTF-8" }
		});
	}
	async function __handler$get() {
		return await handler$get(ctx, createPageResponse);
	}
	return await middleware$1(ctx, __handler$get);
}

export async function put$1(ctx) {
	async function __handler$put() {
		return await handler$put(ctx, create204Response);
	}
	return await middleware$1(ctx, __handler$put);
}

export async function post$1(ctx) {
	async function __handler$post() {
		return await handler$post(ctx, create204Response);
	}
	return await middleware$1(ctx, __handler$post);
}

export async function delete$1(ctx) {
	async function __handler$delete() {
		return await handler$delete(ctx, create204Response);
	}
	return await middleware$1(ctx, __handler$delete);
}
```


# Route `/sales/about`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__sales__about.marko
import page from './src/routes/(foo)/sales/about/+page.marko';

<page ...input />
```
## Handler
```js
// virtual:marko-serve/__marko-serve__route__sales__about.js
import middleware$1 from './src/routes/+middleware.ts';
import { post as handler$post, del as handler$delete } from './src/routes/(foo)/sales/about/+handler.post_delete.js';
import page from 'virtual:marko-serve/__marko-serve__route__sales__about.marko?marko-server-entry';
export { default as meta$2 } from './src/routes/(foo)/sales/about/+meta.marko';

function create204Response() {
	return new Response(null, {
		status: 204
	})
}

export async function get$2(ctx) {
	async function createPageResponse() {
		return new Response(page.stream(ctx), {
			status: 200,
			headers: { "content-type": "text/html;charset=UTF-8" }
		});
	}
	return await middleware$1(ctx, createPageResponse);
}

export async function post$2(ctx) {
	async function __handler$post() {
		return await handler$post(ctx, create204Response);
	}
	return await middleware$1(ctx, __handler$post);
}

export async function delete$2(ctx) {
	async function __handler$delete() {
		return await handler$delete(ctx, create204Response);
	}
	return await middleware$1(ctx, __handler$delete);
}
```


# Route `/$$`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__$$.marko
import page from './src/routes/(foo)/$$/+page.marko';

<page ...input />
```
## Handler
```js
// virtual:marko-serve/__marko-serve__route__$$.js
import middleware$1 from './src/routes/+middleware.ts';
import page from 'virtual:marko-serve/__marko-serve__route__$$.marko?marko-server-entry';

export async function get$3(ctx) {
	async function createPageResponse() {
		return new Response(page.stream(ctx), {
			status: 200,
			headers: { "content-type": "text/html;charset=UTF-8" }
		});
	}
	return await middleware$1(ctx, createPageResponse);
}
```


# Route `/sales`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__sales.marko
import layout1 from './src/routes/sales/+layout.marko';
import page from './src/routes/sales/(overview)/+page.marko';

<layout1 ...input>
	<page ...input />
</>
```
## Handler
```js
// virtual:marko-serve/__marko-serve__route__sales.js
import middleware$1 from './src/routes/+middleware.ts';
import page from 'virtual:marko-serve/__marko-serve__route__sales.marko?marko-server-entry';

export async function get$4(ctx) {
	async function createPageResponse() {
		return new Response(page.stream(ctx), {
			status: 200,
			headers: { "content-type": "text/html;charset=UTF-8" }
		});
	}
	return await middleware$1(ctx, createPageResponse);
}
```


# Route `/sales/invoicing`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__sales__invoicing.marko
import layout1 from './src/routes/sales/+layout.marko';
import layout2 from './src/routes/sales/invoicing/+layout.marko';
import page from './src/routes/sales/invoicing/+page.marko';

<layout1 ...input>
	<layout2 ...input>
		<page ...input />
	</>
</>
```
## Handler
```js
// virtual:marko-serve/__marko-serve__route__sales__invoicing.js
import middleware$1 from './src/routes/+middleware.ts';
import middleware$2 from './src/routes/sales/invoicing/+middleware.ts';
import page from 'virtual:marko-serve/__marko-serve__route__sales__invoicing.marko?marko-server-entry';

export async function get$5(ctx) {
	async function createPageResponse() {
		return new Response(page.stream(ctx), {
			status: 200,
			headers: { "content-type": "text/html;charset=UTF-8" }
		});
	}

	async function __middleware2() {
		return await middleware$2(ctx, createPageResponse);
	}
	return await middleware$1(ctx, __middleware2);
}
```


# Route `/sales/invoicing/$$rest`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__sales__invoicing__$$.marko
import layout1 from './src/routes/sales/+layout.marko';
import layout2 from './src/routes/sales/invoicing/+layout.marko';
import page from './src/routes/sales/invoicing/$$rest/+page.marko';

<layout1 ...input>
	<layout2 ...input>
		<page ...input />
	</>
</>
```
## Handler
```js
// virtual:marko-serve/__marko-serve__route__sales__invoicing__$$.js
import middleware$1 from './src/routes/+middleware.ts';
import middleware$2 from './src/routes/sales/invoicing/+middleware.ts';
import page from 'virtual:marko-serve/__marko-serve__route__sales__invoicing__$$.marko?marko-server-entry';

export async function get$6(ctx) {
	async function createPageResponse() {
		return new Response(page.stream(ctx), {
			status: 200,
			headers: { "content-type": "text/html;charset=UTF-8" }
		});
	}

	async function __middleware2() {
		return await middleware$2(ctx, createPageResponse);
	}
	return await middleware$1(ctx, __middleware2);
}
```


# Route `/sales/invoicing/$id`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__sales__invoicing__$.marko
import layout1 from './src/routes/sales/+layout.marko';
import layout2 from './src/routes/sales/invoicing/+layout.marko';
import page from './src/routes/sales/invoicing/$id/+page.marko';

<layout1 ...input>
	<layout2 ...input>
		<page ...input />
	</>
</>
```
## Handler
```js
// virtual:marko-serve/__marko-serve__route__sales__invoicing__$.js
import middleware$1 from './src/routes/+middleware.ts';
import middleware$2 from './src/routes/sales/invoicing/+middleware.ts';
import page from 'virtual:marko-serve/__marko-serve__route__sales__invoicing__$.marko?marko-server-entry';

export async function get$7(ctx) {
	async function createPageResponse() {
		return new Response(page.stream(ctx), {
			status: 200,
			headers: { "content-type": "text/html;charset=UTF-8" }
		});
	}

	async function __middleware2() {
		return await middleware$2(ctx, createPageResponse);
	}
	return await middleware$1(ctx, __middleware2);
}
```


# Route `/sales/invoicing/foo`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__sales__invoicing__foo.marko
import layout1 from './src/routes/sales/+layout.marko';
import layout2 from './src/routes/sales/invoicing/+layout.marko';
import page from './src/routes/sales/invoicing/foo/+page.marko';

<layout1 ...input>
	<layout2 ...input>
		<page ...input />
	</>
</>
```
## Handler
```js
// virtual:marko-serve/__marko-serve__route__sales__invoicing__foo.js
import middleware$1 from './src/routes/+middleware.ts';
import middleware$2 from './src/routes/sales/invoicing/+middleware.ts';
import page from 'virtual:marko-serve/__marko-serve__route__sales__invoicing__foo.marko?marko-server-entry';

export async function get$8(ctx) {
	async function createPageResponse() {
		return new Response(page.stream(ctx), {
			status: 200,
			headers: { "content-type": "text/html;charset=UTF-8" }
		});
	}

	async function __middleware2() {
		return await middleware$2(ctx, createPageResponse);
	}
	return await middleware$1(ctx, __middleware2);
}
```


# Route `/sales/summary`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__sales__summary.marko
import layout1 from './src/routes/sales/+layout.marko';
import page from './src/routes/sales/summary/+page.marko';

<layout1 ...input>
	<page ...input />
</>
```
## Handler
```js
// virtual:marko-serve/__marko-serve__route__sales__summary.js
import middleware$1 from './src/routes/+middleware.ts';
import page from 'virtual:marko-serve/__marko-serve__route__sales__summary.marko?marko-server-entry';

export async function get$9(ctx) {
	async function createPageResponse() {
		return new Response(page.stream(ctx), {
			status: 200,
			headers: { "content-type": "text/html;charset=UTF-8" }
		});
	}
	return await middleware$1(ctx, createPageResponse);
}
```


# Special `404`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__404.marko
import page from './src/routes/+404.marko';

<page ...input />
```


# Special `500`
## Template
```marko
// virtual:marko-serve/__marko-serve__route__500.marko
import page from './src/routes/+500.marko';

<page ...input />
```
