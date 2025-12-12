import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [
  (ctx) => click(ctx),
  (ctx) => click(ctx),
  (ctx) => click(ctx),
];
export const preview_args = ["--offline", "--no-open"];
export const skip_preview = true //process.env.CI === "true";

async function click({ page }: StepContext) {
  await page.click("button");
}
