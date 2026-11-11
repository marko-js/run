import { Step, StepContext } from "../../main.test";

export const steps: Step[] = [
  (ctx) => click(ctx, "#add"),
  (ctx) => click(ctx, ".remove"),
  (ctx) => click(ctx, ".remove"),
];

async function click({ page }: StepContext, selector: string) {
  await page.click(selector);
}
