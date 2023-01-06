<h1 align="center">
  <!-- Logo -->
  <img src="https://user-images.githubusercontent.com/4985201/115444712-ca550500-a1c9-11eb-9897-238ece59129c.png" height="118"/>
  <br/>
  Marko Run
	<br/>

  <!-- Language -->
  <a href="http://typescriptlang.org">
    <img src="https://img.shields.io/badge/%3C%2F%3E-typescript-blue.svg" alt="TypeScript"/>
  </a>
</h1>

Marko's application framework

## Packages

This is a monorepo facilitated by [npm workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces) and contains the following packages:

### [packages/run](./packages/run/README.md)
This is the core package which consists of
- A Vite plugin that discovers route files in you application and generates routing code
- A runtime which provides a way to import and access the generated routing code

### [adapters/node](./packages/adapters/node/README.md)

### [adapters/netlify](./packages/adapters/netlify/README.md)

### [adapters/static](./packages/adapters/static/README.md)

## Contributing

You probably don't want to touch this code. But in case you do...

### npm Scripts

- `test` Run the tests for all packages
- `build` Runs the build script for all packages

## Setup

Nothing special yet

## Running tests

To run the tests

```
npm run test
```

OR to run specific tests use:

```
npm run test -- --grep "build-routes"
```

To debug, you can use:

```
npm run test -- --inspect-brk --grep "build-routes"
```

## Code of Conduct

This project adheres to the [eBay Code of Conduct](./.github/CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.