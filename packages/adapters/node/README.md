<h1 align="center">
  <!-- Logo -->
  <img src="https://user-images.githubusercontent.com/4985201/115444712-ca550500-a1c9-11eb-9897-238ece59129c.png" height="118"/>
  <br/>
  @marko/serve-adapter-node
	<br/>

  <!-- Language -->
  <a href="http://typescriptlang.org">
    <img src="https://img.shields.io/badge/%3C%2F%3E-typescript-blue.svg" alt="TypeScript"/>
  </a>
  <!-- Format -->
  <a href="https://github.com/prettier/prettier">
    <img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" alt="Styled with prettier"/>
  </a>
</h1>

Adapter for [@marko/serve](../serve/README.md) for use with Connect-style servers

## Intallation

```
npm install @marko/serve-adapter-node
```

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/serve` Vite plugin:

```
import { defineConfig } from "vite";
import marko from "@marko/serve/vite";
import nodeAdapter from "@marko/serve-adapter-node";

export default defineConfig({
  plugins: [
    marko({
      adapter: nodeAdapter()
    })
  ]
});
```

## Middleware

This package provides two different middlwares. Both middleware handle converting Connect-style requests to [WHATWG requests](https://fetch.spec.whatwg.org/#request-class) and similarly writing [WHATWG responses](https://fetch.spec.whatwg.org/#response-class) back to the Connect response.

### Router Middleware
This middleware fully handles requests that match a route.

```ts
// my-app-server.ts
import express from 'express'
import { routerMiddleware } from "@marko/serve-adapter-node/middleware";

express()
  .use("/assets", express.static("assets"))
  .use(routerMiddleware()) // register the router middleware
  .listen(8080);
```

### Match Middleware
This middleware attaches the matched route onto the request object where it can be invoked later. Along with an invoke function, the object will contain the route's meta data. This is useful if you have other middleware that need to run between finding a match and invoking the route.

```ts
// my-app-server.ts
import express from 'express'
import { matchMiddleware } from "@marko/serve-adapter-node/middleware";

express()
  .use("/assets", express.static("assets"))
  .use(matchMiddleware()) // register the match middlware
  // ...other middleware here
  .use((req, res, next) => {
    // `req.route` will be populated if the match middlware found a route
    if (req.route) {
      // do something with `req.route.config` which will contain the route's meta data
    }
    next();
  })
  .use((req, res, next) => {
    if (req.route) {
      // finally invoke the route handler
      req.route.invoke(req, res, next)
    } else {
      next();
    }
  })
  .listen(8080);
```

## Build and Dev 

For now, check out the [examples](../../examples/) directory for more info.