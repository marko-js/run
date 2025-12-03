import { StepContext } from "../../main.test";

export const path = "/123";
export const steps = [clickSubmit];

async function clickSubmit({ page }: StepContext) {
  await page.locator("button").click();
}