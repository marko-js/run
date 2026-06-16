import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [post];

async function post({ page }: StepContext) {
  const url = new URL(page.url());
  const response = await page.request.fetch(url.href, {
    method: "post",
    multipart: {
      name: "MarkoRun",
      age: 7,
      file: {
        name: "file.txt",
        mimeType: "text/plain",
        buffer: Buffer.from('hello\nworld\n', 'utf8')
      }
    },
    timeout: 0
  });
  assert.equal(response.ok(), true, "Post failed");

  const json = await response.json();

  assert.equal(json.issues, null)
}
