import fs from "fs";
import path from "path";
import prettier from "prettier";

await processDir("packages");
await processDir("packages/adapters");

async function processDir(dir) {
  for (const name of fs.readdirSync(dir)) {
    const toggleFile = path.join(dir, name, "package.toggle.json");
    if (!fs.existsSync(toggleFile)) continue;

    const toggleData = readJSON(toggleFile);
    const targetFile = path.join(dir, name, "package.json");
    const targetData = readJSON(targetFile);
    for (const key in toggleData) {
      const value = toggleData[key];
      // JSON has no `undefined`: a key the target lacks is kept as an
      // explicit `null` marker so the next toggle deletes it off the target.
      toggleData[key] = key in targetData ? targetData[key] : null;
      if (value === null) {
        delete targetData[key];
      } else {
        targetData[key] = value;
      }
    }

    await writeJSON(targetFile, targetData);
    await writeJSON(toggleFile, toggleData);
  }
}

function readJSON(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

async function writeJSON(filename, data) {
  // Match the repository's committed formatting so toggling twice is a no-op
  // (prettier keeps objects expanded when the input breaks their lines).
  fs.writeFileSync(
    filename,
    await prettier.format(JSON.stringify(data, null, 2), {
      ...(await prettier.resolveConfig(filename)),
      filepath: filename,
    }),
  );
}
