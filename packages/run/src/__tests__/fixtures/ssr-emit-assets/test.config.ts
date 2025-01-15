import assert from "assert";
import fs from 'fs';
import path from 'path';

export const steps = [];

export async function assert_preview(block) {
  await block();
  const fileSrc = await page.getByRole("article").innerText()
  const filePath = path.join(process.cwd(), "dist", "public", fileSrc)
  assert.equal(fs.existsSync(filePath), true, `Asset ${fileSrc} was not written to dist`);
}