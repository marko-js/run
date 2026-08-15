import assert from "assert";

import { Step } from "../../main.test";

export const steps: Step[] = [
  async ({ page }) => {
    const url = new URL(page.url());
    const response = await page.fetch(url.href, { method: "QUERY" });
    assert.equal(response.ok, true, "Response for QUERY is not ok");
    const body = await response.text();
    assert.ok(
      body.includes("Page rendered"),
      `QUERY did not render the page: "${body}"`,
    );
  },
];
