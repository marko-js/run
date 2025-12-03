import { Step, StepContext } from "../../main.test";

export const path = "/123";
export const steps: Step[] = [(ctx) => clickSubmit(ctx)];

async function clickSubmit({ page }: StepContext) {
  await page.locator("button").click();
}
