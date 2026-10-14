import { fetch } from "@marko/run/router";

export default {
  fetch(request: Request, platform: unknown) {
    return fetch(request, platform);
  },
};
