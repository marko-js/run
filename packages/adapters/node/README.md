<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-darkmode.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-node
	<br/>
</h1>

Preview and deploy [@marko/run](../serve/README.md) apps on Connect-style servers

## Intallation

```
npm install @marko/run-adapter-node
```

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/run` Vite plugin:

```
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import nodeAdapter from "@marko/run-adapter-node";

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
import { routerMiddleware } from "@marko/run-adapter-node/middleware";

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
import { matchMiddleware } from "@marko/run-adapter-node/middleware";

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