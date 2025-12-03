import assert from "assert";
import fs from 'fs';
import path from 'path';

import { Assert } from "../../main.test";

export const steps = [];

export const assert_preview: Assert = async (page, block) =>  {
  await block();
  const fileSrc = await page.getByRole("article").innerText()
  const filePath = path.join(process.cwd(), "dist", "public", fileSrc)
  assert.equal(fs.existsSync(filePath), true, `Asset ${fileSrc} was not written to dist`);
}