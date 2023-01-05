import netlifyEdgeAdapter from "@hattip/adapter-netlify-edge";
import { handler } from "@marko/serve";

export default netlifyEdgeAdapter(handler);