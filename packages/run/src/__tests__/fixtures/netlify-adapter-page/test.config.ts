export const steps = [click, click, click];
export const preview_args = ["--offline"];
export const skip_preview = process.env.CI === "true";

async function click() {
  await page.click("button");
}