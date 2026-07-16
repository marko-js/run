// The raw Marko render (HTML string chunks) stashed on a page `Response` so a
// byte-sink adapter can write it straight to the socket, bypassing the body.
const kDirectRender = Symbol("marko-run.directRender");

export type DirectRender = AsyncIterable<string>;

type Tagged = { [kDirectRender]?: DirectRender };

export function setDirectRender(
  response: Response,
  render: DirectRender,
): void {
  (response as Tagged)[kDirectRender] = render;
}

export function getDirectRender(response: Response): DirectRender | undefined {
  return (response as Tagged)[kDirectRender];
}
