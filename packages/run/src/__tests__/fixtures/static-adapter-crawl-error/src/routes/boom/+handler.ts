// Crawled as a param-free route by the static adapter's `buildEnd`. Its status
// is neither 2xx nor a redirect, so no file is written for it and the build has
// to fail rather than deploy a site with the page missing.
export const GET = Run.GET(() => new Response("nope", { status: 503 }));
