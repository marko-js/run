import netlifyEdgeAdapter from "@hattip/adapter-netlify-edge";
import { handler } from "@marko/run";

export default netlifyEdgeAdapter(handler);