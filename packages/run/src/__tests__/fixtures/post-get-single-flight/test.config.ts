export const path = "/123";
export const steps = [clickSubmit];

async function clickSubmit() {
  await page.locator("button").click();
}