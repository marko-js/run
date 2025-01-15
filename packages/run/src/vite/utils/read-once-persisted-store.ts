import { promises as fs } from "fs";
import os from "os";
import path from "path";

const noop = () => {};
const tmpFile = path.join(os.tmpdir(), "marko-run-storage.json");
const values: Map<string, unknown> = new Map();
let loadedFromDisk: Promise<void> | true | undefined;

export class ReadOncePersistedStore<T> {
  constructor(private uid: string) {}
  write(value: T): void {
    values.set(this.uid, value);
  }
  async read(): Promise<T> {
    const { uid } = this;
    if (values.has(uid)) {
      const value = values.get(uid);
      values.delete(uid);
      return value as T;
    }

    if (loadedFromDisk === true) {
      throw new Error(`Value for ${uid} could not be loaded.`);
    }

    await (loadedFromDisk ||= fs
      .readFile(tmpFile, "utf-8")
      .then(syncDataFromDisk)
      .catch(finishLoadFromDisk));

    return this.read();
  }
}

function syncDataFromDisk(data: string) {
  finishLoadFromDisk();
  fs.unlink(tmpFile).catch(noop);
  for (const [k, v] of JSON.parse(data) as [string, unknown][]) {
    values.set(k, v);
  }
}

function finishLoadFromDisk() {
  loadedFromDisk = true;
}

process.once("beforeExit", (code) => {
  if (code === 0 && values.size) {
    fs.writeFile(tmpFile, JSON.stringify([...values])).catch(noop);
  }
});
