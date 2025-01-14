import { Readable } from "stream";

import { getFileStream } from "../../../data";

export const GET = MarkoRun.route(async (context) => {
  const fileStream = getFileStream(context.params.id);
  if (!fileStream) {
    return new Response(null, {
      status: 404,
    });
  }
  return new Response(Readable.toWeb(fileStream) as any, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
});
