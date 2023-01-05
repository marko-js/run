import netlifyFunctionsAdapter from "@hattip/adapter-netlify-functions";
import { handler } from "@marko/serve";

export const handler = netlifyFunctionsAdapter(hattipHandler);