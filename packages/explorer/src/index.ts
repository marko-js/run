import { createMiddleware } from "@marko/run/adapter/middleware";
import { fetch } from "@marko/run/router";
export default createMiddleware(fetch);