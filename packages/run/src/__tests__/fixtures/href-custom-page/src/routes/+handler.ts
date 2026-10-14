import CustomPage from "./custom-page.marko";

export const GET: MarkoRun.Handler = (ctx) => ctx.render(CustomPage, {});
