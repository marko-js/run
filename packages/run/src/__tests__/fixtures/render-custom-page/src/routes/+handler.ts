import CustomPage from "./custom-page.marko";

export const GET: MarkoRun.Handler = (ctx) => {
  return ctx.render(CustomPage, { title: "Custom Page" });
}