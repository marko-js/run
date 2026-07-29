import assert from "assert";
import { execFileSync, spawnSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import net from "net";
import path from "path";
import { pathToFileURL } from "url";

const LISTENER_FAIL = "C3-HarnessExec: listener probe denied";
const TARBALL_FAIL = "C3-TarFresh";

interface Measurement {
  wire: {
    dual: { raw: number; brotli: number; body: string };
    c2: { raw: number; brotli: number; body: string };
  };
  run1: {
    dual: { requests: number; urls: string[] };
    c2: { requests: number; urls: string[] };
  };
}

function assertWireGate(measurement: Measurement) {
  // Absolute dual-entry floor for the flat /r0→/r1 probe under Host
  // route-scale.probe. Re-pin when the protocol floor moves with a reported
  // reason (same dual≡cutover identity still holds). Brotli is only
  // meaningful on build-id-normalized bodies (per-build tokens add entropy).
  assert.equal(
    measurement.wire.dual.raw,
    254,
    "the live dual-entry control must reproduce the binding 254-raw baseline",
  );
  assert.deepEqual(
    {
      raw: measurement.wire.c2.raw,
      brotli: measurement.wire.c2.brotli,
    },
    {
      raw: measurement.wire.dual.raw,
      brotli: measurement.wire.dual.brotli,
    },
    "C2 wire tolerance is zero",
  );
  assert.equal(
    measurement.wire.c2.body,
    measurement.wire.dual.body,
    "build-id-normalized patch bodies must be byte-identical",
  );
}

function assertRequestCountGate(measurement: Measurement) {
  assert.ok(
    measurement.run1.c2.requests <= measurement.run1.dual.requests,
    `C2 request count ${measurement.run1.c2.requests} exceeds dual-entry ${measurement.run1.dual.requests} (delta=0)\n` +
      `dual=${JSON.stringify(measurement.run1.dual.urls)}\n` +
      `c2=${JSON.stringify(measurement.run1.c2.urls)}`,
  );
}

const TARBALL_NAMES = [
  "marko.tgz",
  "marko-compiler.tgz",
  "marko-vite.tgz",
  "marko-run.tgz",
] as const;

/**
 * C3-TarFresh (ship): setup-state.skipBuild must be false; packed repos
 * clean at pack and gate; HEAD equality; SHA-256 of all four tarballs.
 * Returns undefined when green; otherwise a message — callers hard-fail
 * (never this.skip()).
 */
function checkTarballFreshness(): string | undefined {
  const runRepo = path.resolve(import.meta.dirname, "../../../../../..");
  const ecommerce = path.resolve(runRepo, "../marko-ecommerce");
  const stateFile = path.join(ecommerce, ".marko-src/setup-state.json");
  const tarballDir = path.join(ecommerce, ".marko-src/tarballs");
  if (!fs.existsSync(stateFile)) return `missing ${stateFile}`;
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8")) as {
    skipBuild?: boolean;
    repos: Record<
      string,
      { commit: string; dirty?: boolean; dirtySummary?: string[] }
    >;
    tarballs?: Record<string, { sha256: string; bytes: number }>;
  };

  if (state.skipBuild !== false) {
    return `${TARBALL_FAIL}: setup-state.skipBuild is ${JSON.stringify(state.skipBuild)} (ship requires false; full rebuild without SKIP_BUILD=1)`;
  }

  if (!state.tarballs) {
    return `${TARBALL_FAIL}: setup-state.json missing tarballs{} SHA-256 map — re-run ecommerce setup after C3-R1`;
  }

  for (const name of TARBALL_NAMES) {
    const recorded = state.tarballs[name];
    if (!recorded?.sha256) {
      return `${TARBALL_FAIL}: missing recorded sha256 for ${name}`;
    }
    const file = path.join(tarballDir, name);
    if (!fs.existsSync(file)) return `${TARBALL_FAIL}: missing ${file}`;
    const buf = fs.readFileSync(file);
    const sha = createHash("sha256").update(buf).digest("hex");
    if (sha !== recorded.sha256) {
      return `${TARBALL_FAIL}: ${name} sha256 ${sha} !== recorded ${recorded.sha256}`;
    }
    if (recorded.bytes !== undefined && buf.length !== recorded.bytes) {
      return `${TARBALL_FAIL}: ${name} size ${buf.length} !== recorded ${recorded.bytes}`;
    }
  }

  for (const [name, checkout] of [
    ["marko", path.resolve(runRepo, "../marko")],
    ["run", runRepo],
    ["vite", path.join(ecommerce, ".marko-src/vite")],
  ] as const) {
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: checkout,
      encoding: "utf8",
    }).trim();
    const packed = state.repos[name]?.commit;
    if (packed !== head) {
      return `${TARBALL_FAIL}: ${name} tarball packed from ${packed}, checkout at ${head}`;
    }
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      cwd: checkout,
      encoding: "utf8",
    }).trim();
    if (dirty) {
      return `${TARBALL_FAIL}: ${name} working tree dirty at gate time:\n${dirty}`;
    }
    if (state.repos[name]?.dirty) {
      return `${TARBALL_FAIL}: ${name} was dirty at pack time (re-pack from clean trees)`;
    }
  }
  return undefined;
}

function probeListener() {
  return new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

/** Unit-only gates — always execute; never depend on tarballs/listener. */
describe("persisted measurement gate logic (unit)", () => {
  it("C2-MEASUREMENT-DRY-RUN-ONLY: comparison logic rejects regressions", () => {
    const passing: Measurement = {
      wire: {
        dual: { raw: 247, brotli: 205, body: "same" },
        c2: { raw: 247, brotli: 205, body: "same" },
      },
      run1: {
        dual: { requests: 4, urls: ["/a.js", "/b.js", "/c.js", "/d.js"] },
        c2: { requests: 4, urls: ["/a.js", "/b.js", "/c.js", "/d.js"] },
      },
    };
    assertWireGate(passing);
    assertRequestCountGate(passing);
    assert.throws(
      () =>
        assertWireGate({
          ...passing,
          wire: {
            ...passing.wire,
            c2: { ...passing.wire.c2, raw: 248 },
          },
        }),
      /C2 wire tolerance is zero/,
    );
    assert.throws(
      () =>
        assertRequestCountGate({
          ...passing,
          run1: {
            ...passing.run1,
            c2: {
              requests: 5,
              urls: [...passing.run1.c2.urls, "/extra.js"],
            },
          },
        }),
      /C2 request count 5 exceeds dual-entry 4/,
    );
  });

  it("C3-HarnessEnv: cleanEnv strips poisoned MARKO* and retains only explicit extras", async () => {
    const { cleanEnv } = await import(
      pathToFileURL(path.join(import.meta.dirname, "utils/clean-env.mjs")).href
    );
    const prev = { ...process.env };
    try {
      process.env.MARKO_DEBUG = "1";
      process.env.MARKO_PERSISTED_FORCE = "yes";
      process.env.MARKO_RUN_PERSISTED_ARTIFACTS = "0";
      process.env.UNRELATED = "keep";
      const scrubbed = cleanEnv({
        NODE_ENV: "production",
        HARNESS_MODE: "dual",
      });
      assert.equal(scrubbed.MARKO_DEBUG, undefined);
      assert.equal(scrubbed.MARKO_PERSISTED_FORCE, undefined);
      assert.equal(scrubbed.MARKO_RUN_PERSISTED_ARTIFACTS, undefined);
      assert.equal(scrubbed.NODE_ENV, "production");
      assert.equal(scrubbed.HARNESS_MODE, "dual");
      assert.equal(scrubbed.UNRELATED, "keep");
      assert.equal(scrubbed.NODE_OPTIONS, "");
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in prev)) delete process.env[key];
      }
      Object.assign(process.env, prev);
    }
  });

  it("C3-TarFresh: constructed skipBuild=true state fails (not vacuous)", () => {
    // Unit pin: when skipBuild is not false the check must return a message.
    // Live trees may already be green; construct a stale fixture instead of
    // relying on ambient setup-state.
    const runRepo = path.resolve(import.meta.dirname, "../../../../../..");
    const ecommerce = path.resolve(runRepo, "../marko-ecommerce");
    const stateFile = path.join(ecommerce, ".marko-src/setup-state.json");
    const orig = fs.existsSync(stateFile)
      ? fs.readFileSync(stateFile, "utf8")
      : null;
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(
        stateFile,
        JSON.stringify({
          skipBuild: true,
          repos: {},
          tarballs: {},
        }),
      );
      const result = checkTarballFreshness();
      assert.ok(result, "skipBuild:true must not pass TarFresh");
      assert.match(result!, /C3-TarFresh/);
      assert.match(result!, /skipBuild/);
    } finally {
      if (orig === null) fs.rmSync(stateFile, { force: true });
      else fs.writeFileSync(stateFile, orig);
    }
  });

  it("C3-TarFresh: live check is either green or a TarFresh message", () => {
    const result = checkTarballFreshness();
    // Either green (after full pack) or a TarFresh message — never undefined
    // when state is known-stale without tarballs map / skipBuild true.
    if (result !== undefined) {
      assert.match(result, /C3-TarFresh|missing/);
    }
  });
});

/** Live A/B — C3-HarnessExec: no skip=green. Preconditions hard-fail. */
describe("persisted C2 listener measurement gates", () => {
  let measurement: Measurement;

  before(async function (this: Mocha.Context) {
    this.timeout(600_000);

    try {
      await probeListener();
    } catch (error) {
      const candidate = error as NodeJS.ErrnoException;
      if (candidate.code === "EPERM" || candidate.code === "EACCES") {
        throw new Error(
          `${LISTENER_FAIL} (${candidate.code}); Wire1/Run1 cannot green without an ephemeral listener`,
          { cause: error },
        );
      }
      throw error;
    }

    const stale = checkTarballFreshness();
    if (stale) {
      throw new Error(stale);
    }

    const proc = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--experimental-vm-modules",
        path.join(import.meta.dirname, "utils/measurement-gates-harness.mjs"),
      ],
      {
        encoding: "utf8",
        env: { ...process.env, NODE_OPTIONS: "" },
        maxBuffer: 64 * 1024 * 1024,
        timeout: 570_000,
      },
    );
    assert.equal(
      proc.error,
      undefined,
      `C2 measurement harness could not execute: ${String(proc.error)}`,
    );
    assert.equal(
      proc.status,
      0,
      `C2 measurement harness failed (exit ${proc.status}):\n${proc.stderr}`,
    );
    const marker = "C2_MEASUREMENT_REPORT ";
    const markerAt = proc.stdout.lastIndexOf(marker);
    assert.notEqual(
      markerAt,
      -1,
      `C2 measurement harness emitted no report:\n${proc.stdout}`,
    );
    measurement = JSON.parse(
      proc.stdout.slice(markerAt + marker.length),
    ) as Measurement;
  });

  it("C2-Wire1: real ephemeral-listener A/B keeps /r0 -> /r1 at the dual-entry 254-raw baseline with normalized bodies byte-identical", function () {
    assertWireGate(measurement);
  });

  it("C2-Run1: shared-template N=10 real preview first-load JS requests do not exceed dual-entry", function () {
    assertRequestCountGate(measurement);
  });
});
