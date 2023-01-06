import netlifyFunctionsAdapter from "@hattip/adapter-netlify-functions";
import { handler } from "@marko/run";

export const handler = netlifyFunctionsAdapter(hattipHandler);