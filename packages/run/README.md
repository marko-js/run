> **Warning**
> This project is in BETA - use at your own peril, but please do provide helpful feedback.

<div align="center">
  <!-- Logo -->
  <h1>
    <img alt="" src="https://user-images.githubusercontent.com/4985201/115444712-ca550500-a1c9-11eb-9897-238ece59129c.png" height="118"/>
    <br/>
    @marko/run
  </h1>

  <!-- Language -->
  <a href="https://www.typescriptlang.org">
    <img src="https://img.shields.io/badge/%3C%2F%3E-typescript-blue.svg" alt="TypeScript"/>
  </a>
</div>

`@marko/run` is an application framework for [Marko](https://markojs.com), with these features:

- Vite plugin that encapsulates [`@marko/vite`](https://github.com/marko-js/vite)
- CLI to simplify build modes
- File-based routing with layouts and middleware
- Efficient routing using a compiled static trie
- [Designed with web standards](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern) to run anywhere
- TypeScript support

## Installation

```sh
npm install @marko/run
```

## CLI

The package provides a command line tool `marko-run` which can be run using scripts in your package.json or with npx.

### Getting Started / Zero Config

`marko-run` makes it easy to get started without little to no config. The package ships with a default Vite config and node-based adapter that means a minimal project start can be:
1. Install `@marko/run`
2. Create file `src/routes/+page.marko`
3. Run `npx marko-run dev`
4. Open browser to `http://localhost:3000`

### Commands

**`dev`** - Start development server in watch mode
```bash
> npx marko-run dev
```

**`build`** - Create a production build
```bash
> npx marko-run build
```

**`serve`** - Create a production build and serve
```bash
> npx marko-run serve
```
or (default command)
```bash
> npx marko-run
```

## Vite Plugin

This package’s Vite plugin discovers your route files, generates the routing code, and registers the `@marko/vite` plugin to compile your `.marko` files.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite"; // Import the Vite plugin

export default defineConfig({
  plugins: [marko()], // Register the Vite plugin
})
```

## Adapters

<!-- TODO: link to existing adapters>

<!-- *🎗 TODO: provide a quick overview* -->

## Runtime

Generally, when using an adapter, this runtime will be abstracted away.

<!-- TODO: Add examples -->
<!-- TODO: Split fetch and match + invoke in two sections and explain why you might use one or the other  -->

```ts
import { router, matchRoute, invokeRoute } from '@marko/run/router`;
```

### `fetch`

```ts
async function fetch<T>(request: Request, platform: T) => Promise<Response | void>;
```

This asynchronous function takes a [WHATWG `Request` object](https://fetch.spec.whatwg.org/#request-class) object and an object containing any platform specific data you may want access to and returns the [WHATWG `Response` object](https://fetch.spec.whatwg.org/#response-class) from executing any matched route files or undefined if the request was explicitly not handled. If no route matches the requested path, a `404` status code response will be returned. If an error occurs a `500` status code response will be returned.

### `match`

```ts
interface interface Route {
  params: Record<string, string>;
  meta: unknown;
}

function match(method: string, pathname: string) => Route | null;
```

This synchronous function takes an HTTP method and path name, then returns an object representing the best match — or `null` if no match is found.

- `params` - a `{ key: value }` collection of any path parameters for the route
- `meta` - metadata for the route

### `invoke`

```ts
async function invoke<T>(route: Route, request: Request, platform: T) => Promise<Response | void>;
```
This asynchronous function takes a route object returned by [match](#match) the request and platform data and returns a response in the same way the [fetch](#fetch) does.



## File-based Routing

<!-- ### Nested Routing

*🎗 TODO: provide a quick overview* -->

### Routes Directory

The plugin looks for route files in the configured **routes directory**. By default, that’s `./src/routes`, relative to the Vite config file.

To change what directory routes are found in:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";

export default defineConfig({
  plugins: [marko({
    routesDir: 'src/pages' // Use `./src/pages` (relative to this file) as the routes directory
  })]
})
```

### Routeable Files

To allow for colocation of files that shouldn’t be served (like tests, assets, etc.), the router only recognizes certain filenames.

The following filenames will be discovered in any directory inside your application’s [routes directory](#routes-directory).

#### `+page.marko`

These files establish a route at the current directory path which will be served for `GET` requests with the HTML content of the page. Only one page may exists for any served path.

#### `+layout.marko`

These files provide a **layout component**, which will wrap all nested layouts and pages.

Layouts are like any other Marko component with no extra constraints. Each layout receives the request, path params, URL, and route metadata as input, as well as a `renderBody` which will be the next layout or page to project. 

```marko
<main>
  <h1>My Products</h1>

  ${input.renderBody} // render the page or layout here
</main>
```

#### `+handler.*`

These files establish a route at the current directory path which can handle requests for `GET`, `POST`, `PUT`, and `DELETE` HTTP methods. <!-- TODO: what about HEAD? -->

Typically, these will be `.js` or `.ts` files depending on your project. Like pages, only one handler may exist for any served path. A handler should export functions

<details>
  <summary>More Info</summary>
  
  - Valid exports are functions named `get`, `post`, `put`, or `del`.
  - Each export receives a `context` and `next` argument, and should return a WHATWG `Response` either synchronously or asynchronously.
    - The `context` argument contains the WHATWG request object, path parameters, URL, and route metadata.
    - The `next` argument will call the page for get requests where applicable or return a `204` response.

  ```js
  export function post(context, next) {
    const { request, params, url, meta } = context;
    return new Response('Successfully updated', { status: 200 });
  }

  export function put(context, next) {
    return new Response('Successfully created', { status: 201 }); // handle the request
  }

  export function get(context, next) {
    return next(); // Call the next handler
  }

  export function del(context, next) {
    return new Response('Successfully removed', { status: 204 });
  }
  ```
</details>


#### `+middleware.*`

These files are like layouts, but for handlers. Middleware get called before handlers and let you perform arbitrary work before and after.

> **Note**: Unlike handlers, middleware run for all HTTP methods.

<details>
  <summary>More Info</summary>
  
  Expects a `default` export that receives a `context` and `next` argument, and should return a WHATWG response either synchronously or asynchronously.
	
  - The `context` argument contains the WHATWG `Request` object, path parameters, URL, and route metadata.
  - The `next` argument will call the next middleware, handler, or page for the route.

  ```ts
  export default async function(context, next) {
    const requestName = `${ctx.request.method} ${ctx.url.href}`; // TODO: could this be just `ctx.url` with a `toString` that then grabs `.href`?
    let success = true;
    console.log(`${requestName} request started`)
    try {
      return await next(); // Wait for subsequent middleware/handler/page
    } catch (err) {
      success = false;
      throw err;
    } finally {
      console.log(`${requestName} completed ${success ? 'successfully' : 'with errors'}`);
    }
  }
  ```
</details>

#### `+meta.*`

These files represent metadata to attach to the route. This metadata will be automatically provided on the the route `context` when invoking a route. 

### Special Files

In addition to the files above which can be defined in any directory under the _routes directory_, there are some special files which can only be defined at the top-level of the _routes directory_. <!-- TODO: do we want to keep this restriction? Having nested 404s would be handy for disambiguating things like “there’s no user with that name” or “that promotion wasn’t found, it may have expired” -->

These special pages are subject to a root layout file (`pages/+layout.marko` in the default configuration).

#### `+404.marko`

This special page responds to any request where:

- The `Accept` request header includes `text/html`
- *And* no other handler or page rendered the request

Responses with this page will have a `404` status code.

#### `+500.marko`

This special page responds to any request where:

- The `Accept` request header includes `text/html`
- *And* an uncaught error occurs while serving the request

Responses with this page will have a `500` status code.

### Execution Order

<!-- TODO: add file tree and update flow-chart with file names -->

For a matched route, the routable files execute in the following order:

1. Middlewares from root-most to leaf-most
2. Handler
3. Layouts from root-most to leaf-most
4. Page

```mermaid
sequenceDiagram
    participant Middleware1
    participant Middleware2
    participant Handler
    participant Layout1
    participant Layout2
    participant Page
    Note over Layout1,Page: Combined at build-time as a single component
    Middleware1->>Middleware2: next()
    Middleware2->>Handler: next()
    Handler->>Layout1: next()
    Layout1->Layout2: ${input.renderBody}
    Layout2->Page: ${input.renderBody}
    Layout1-->>Handler: Stream Response
    Handler-->>Middleware2: Response
    Middleware2-->>Middleware1: Response
```

### Path Structure

Within the _routes directory_, the directory structure will determine the path the route will be served. There are four types of directory names: static, pathless, dynamic, and catch-all.

1. **Static directories** - The most common type. Each static directory contributes its name as a segment in the route's served path, like a traditional fileserver. Unless a directory name matches the requirements for one of the below types, it defaults to a static directory.

  Examples:
  ```
  /foo
  /users
  /projects
  ```

2. **Pathless directories** - These directories do **not** contribute their name to the route's served path. Directory names that start with an underscore (`_`) will be a pathless directory.

  Examples:
  ```
  /_users
  /_public
  ```

3. **Dynamic directories** - These directories introduce a dynamic parameter to the route's served path and will match any value at that segment. Any directory name that starts with a single dollar sign (`$`) will be a dynamic directory, and the remaining directory name will be the parameter at runtime. If the directory name is exactly `$`, the parameter will not be captured but it will be matched.

  Examples:
  ```
  /$id
  /$name
  /$
  ```

4. **Catch-all directories** - These directories are similar to dynamic directories and introduce a dynamic parameter, but instead of matching a single path segment, they match to the end of the path. Any directory that starts with two dollar signs (`$$`) will be a catch-all directory, and the remaining directory name will be the parameter at runtime. In the case of a directory named `$$`, the parameter name will not be captured but it will match. Catch-all directories can be used to make `404` Not Found routes at any level, including the root.

  Because catch-all directories match any path segment and consume the rest of the path, you cannot nest route files in them and no further directories will be traversed.

  Examples:
  ```
  /$$all
  /$$rest
  /$$
  ```

<!-- ### Match Ranking

*TODO: Write some things* -->


## TypeScript

