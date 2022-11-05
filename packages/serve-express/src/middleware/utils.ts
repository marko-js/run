import type { Connect } from "vite";

export function createAsyncMiddleware(
  name: string,
  fn: () => Promise<Connect.NextHandleFunction | undefined>
): Connect.NextHandleFunction {
  const passthrough: Connect.NextHandleFunction = (_req, _res, next) => {
    console.log(`${name}: passthrough`);
    next();
  };

  let isLoaded = false;
  const promise = fn().then((handler) => {
    middleware = handler || passthrough;
    console.log(`${name}: middleware loaded`);
    isLoaded = true;
  });
  console.log(`${name}: loading middleware`);
  let middleware: Connect.NextHandleFunction = async (req, res, next) => {
    console.log(`${name}: called middleware before it was loaded`);
    await promise;
    middleware(req, res, next);
  };

  return (req, res, next) => {
    console.log(
      `${name}: calling middleware, loaded=${isLoaded ? "true" : "false"}`
    );
    return middleware(req, res, next);
  };
}
