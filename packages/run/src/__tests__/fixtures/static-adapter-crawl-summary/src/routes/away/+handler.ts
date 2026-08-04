// Linked from the page and crawled as a param-free route: a redirect is its own
// bucket in the crawl summary rather than a successful prerender.
export const GET = Run.GET((ctx) => ctx.redirect("/other"));
