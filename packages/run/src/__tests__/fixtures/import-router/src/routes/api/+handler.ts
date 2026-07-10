import { describeMatch } from "../../helpers/describe-match";

export const GET: MarkoRun.Handler = (context) => {
  return new Response(
    describeMatch(context.request.method, context.url.pathname),
  );
};
