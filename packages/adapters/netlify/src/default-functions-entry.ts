import type { Config } from "@netlify/functions";

export { fetch as default } from "@marko/run/router";
export const config: Config = {
  path: "/*",
  preferStatic: true,
};
