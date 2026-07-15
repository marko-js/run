import assert from "assert";

import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [post];

async function post({ page }: StepContext) {
  const body = new FormData();
  body.append("name", "MarkoRun");
  body.append("age", "7");
  body.append(
    "file",
    new File(["hello\nworld\n"], "file.txt", { type: "text/plain" }),
  );

  const response = await page.fetch(page.url(), {
    method: "POST",
    body,
  });
  assert.equal(response.ok, true, "Post failed");

  const json = await response.json();

  assert.equal(json.issues, null);
}
