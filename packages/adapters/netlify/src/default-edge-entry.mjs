import netlifyEdgeAdapter from "@hattip/adapter-netlify-edge";
import { handler } from "@marko/run/router";

export default netlifyEdgeAdapter(handler);