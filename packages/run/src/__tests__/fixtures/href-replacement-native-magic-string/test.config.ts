import { Step, StepContext } from "../../main.test";

// Only the production build hands transform results to Rolldown.
export const skip_dev = true;

export const steps: Step[] = [(ctx) => click(ctx), (ctx) => click(ctx)];

async function click({ page }: StepContext) {
  await page.click("button");
}
