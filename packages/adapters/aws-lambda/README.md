<h1 align="center">
  <!-- Logo -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/marko-js/run/raw/main/assets/marko-run.png">
    <img alt="Marko Run Logo" src="https://github.com/marko-js/run/raw/main/assets/marko-run.png" width="400">
  </picture>
  <br/>
  @marko/run-adapter-aws-lambda
	<br/>
</h1>

Preview and deploy [@marko/run](../../run/README.md) apps to AWS Lambda

## Installation

```sh
npm install @marko/run-adapter-aws-lambda
```

## Usage

In your application's Vite config file (eg. `vite.config.js`), import and register this adapter with the `@marko/run` Vite plugin:

```ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import awsLambdaAdapter from "@marko/run-adapter-aws-lambda";

export default defineConfig({
  plugins: [
    marko({
      adapter: awsLambdaAdapter(),
    }),
  ],
});
```

Running `marko-run build` produces a self-contained Lambda handler at `dist/index.mjs` (exported as `handler`) plus the static assets in `dist/public`. The handler targets the [API Gateway HTTP API / Lambda Function URL payload format version 2.0](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html), and serves the bundled static assets when no route matches.

`marko-run preview` runs the handler behind a local HTTP server so you can test it without deploying.

## Deploying

Package the `dist` directory and deploy it as a Lambda function, using `index.handler` as the handler and a Node.js runtime (eg. `nodejs20.x`). Wire it up to a [Function URL](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html) or an API Gateway HTTP API. For example, with the AWS CLI:

```sh
marko-run build
( cd dist && zip -r ../function.zip . )
aws lambda update-function-code --function-name my-app --zip-file fileb://function.zip
```

Any IaC tool works too (AWS SAM, CDK, Serverless Framework, Terraform) — point the function's handler at `index.handler` and its code at the `dist` directory.

## Platform info

The raw Lambda event and invocation context are available on the `platform` argument of your route handlers:

```ts
import type { AWSLambdaPlatformInfo } from "@marko/run-adapter-aws-lambda";

export const GET = (context, { platform }) => {
  const { event, context: lambdaContext } = platform as AWSLambdaPlatformInfo;
  return new Response(`Request id: ${lambdaContext.awsRequestId}`);
};
```
