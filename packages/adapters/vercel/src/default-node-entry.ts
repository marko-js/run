import { createMiddleware } from "@marko/run/adapter/middleware";
import { fetch } from "@marko/run/router";

// Vercel's Node.js runtime invokes the default export as a standard
// `(req, res)` request listener. Static assets are served by Vercel's
// filesystem layer, so the function only needs to handle dynamic routes.
export default createMiddleware(fetch);
