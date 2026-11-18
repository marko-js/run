import assert from "assert";
import { request } from "http";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [
  (ctx) => click(ctx),
  (ctx) => click(ctx),
  (ctx) => click(ctx),
  (ctx) => keepsServing(ctx),
];

async function click({ page }: StepContext) {
  await page.click("button");
}

// A path with a leading `//` and an escaped separator must be answered
// without stopping the server.
async function keepsServing({ page }: StepContext) {
  const { port } = new URL(page.url());
  const script = page.document.querySelector("script[src]");
  const asset = new URL(script!.getAttribute("src")!, page.url()).pathname;
  const path = `/${asset.slice(0, 1)}${asset.slice(1).replace(/\//g, "%2F")}`;
  await rawGet(Number(port), path).catch(() => {});

  const response = await page.fetch("/");
  assert.equal(response.status, 200);
}

function rawGet(port: number, path: string) {
  return new Promise<number | undefined>((resolve, reject) =>
    request({ port, path }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    })
      .on("error", reject)
      .end(),
  );
}
