export const steps = [click, click, click];
export const preview_args = ["--offline"];

async function click() {
  await page.click("button");
}