import netlifyFunctionsAdapter from "@hattip/adapter-netlify-functions";
import { handler } from "@marko/run/router";

export default netlifyFunctionsAdapter(handler);