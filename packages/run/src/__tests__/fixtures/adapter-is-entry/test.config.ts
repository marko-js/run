export const entry = 'src/index.ts';

export const steps = [click, click, click];

async function click() {
  await page.click("button");
}
