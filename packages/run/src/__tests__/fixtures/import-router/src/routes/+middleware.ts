import { describeMatch } from "../helpers/describe-match";

const middleware: MarkoRun.Handler = (context) => {
  context.data = describeMatch(context.request.method, context.url.pathname);
};

export default middleware;
