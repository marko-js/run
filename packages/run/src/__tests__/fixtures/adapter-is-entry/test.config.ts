import { StepContext } from "../../main.test";

export const entry = 'src/index.ts';

export const steps = [click, click, click];

async function click({ page }: StepContext) {
  await page.click("button");
}
