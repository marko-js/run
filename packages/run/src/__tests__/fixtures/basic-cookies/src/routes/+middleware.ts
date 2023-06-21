declare module '@marko/run' {
  interface Context {
    expectedCookies: string
  }
}

const middleware: MarkoRun.Handler = async (context, next) => {
  const cookies = [
    "a=1; Expires = Fri, 15 Jun 2023 12:00:00 GMT; path=/mon",
    "b=2; Expires=Sat, 15 May 2023 18:00:00 GMT",
  ];

  context.expectedCookies = JSON.stringify(cookies);

  const response = await next();
  
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
};

export default middleware;
