import { Step, StepContext } from "../../main.test";

export const entry = "src/index.ts";

export const steps: Step[] = [
  (ctx) => click(ctx),
  (ctx) => click(ctx),
  (ctx) => click(ctx),
];

async function click({ page }: StepContext) {
  await page.click("button");
}
