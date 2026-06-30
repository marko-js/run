import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [
  (ctx) => click(ctx),
  (ctx) => click(ctx),
  (ctx) => click(ctx),
];
// Preview requires the Vercel CLI, which isn't available in CI.
export const skip_preview = true;

async function click({ page }: StepContext) {
  await page.click("button");
}
