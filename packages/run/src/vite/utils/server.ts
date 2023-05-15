import net, { type Socket } from "net";
import cp, { type ChildProcess, type StdioOptions } from "child_process";
import { parse, config } from 'dotenv';
import fs from "fs";
import cluster, { type Address, type Worker } from "cluster";

export interface SpawnedServer {
  port: number,
  close(): Promise<void> | void
}

export async function parseEnv(envFile: string) {
  if (fs.existsSync(envFile)) {
    const content = await fs.promises.readFile(envFile, 'utf8');
    return parse(content);
  }
}

export function loadEnv(envFile: string) {
  config({ path: envFile });
}

export async function spawnServer(
  cmd: string,
  args: string[] = [],
  port: number = 0,
  env?: string | Record<string, string>,
  cwd: string = process.cwd(),
  wait: number = 30_000,
  stdio: StdioOptions = ['ignore', 'inherit', 'inherit']
): Promise<SpawnedServer> {
  if (port <= 0) {
    port = await getAvailablePort();
  }

  if (typeof env === 'string') {
    env = await parseEnv(env);
  }

  const proc = cp.spawn(cmd, args, {
    cwd,
    shell: true,
    stdio,
    windowsHide: true,
    env: { ...env, NODE_ENV: "development", ...process.env, PORT: `${port}` },
  });

  const close = () => {
    proc.unref();
    proc.kill();
  };

  try {
    await Promise.race([
      waitForError(proc, port),
      waitForServer(port, wait)
    ])
  } catch (err) {
    close();
    throw err;
  }

  return {
    port,
    close
  };
}

export async function spawnServerWorker(
  module: string,
  args: string[] = [],
  port: number = 0,
  env?: string | Record<string, string>,
): Promise<Worker> {
  if (port <= 0) {
    port = await getAvailablePort();
  }
  if (typeof env === 'string') {
    env = await parseEnv(env);
  }

  const originalExec = cluster.settings.exec;
  const originalArgs = cluster.settings.execArgv;

  try {
    cluster.settings.exec = module;
    cluster.settings.execArgv = args;
    const worker = cluster.fork({ ...env, NODE_ENV: "development", ...process.env, PORT: `${port}` });
    return new Promise<Worker>((resolve) => {
      function ready(message: any) {
        if (message === 'ready') {
          worker.off('message', ready);
          resolve(worker);
        }
      }
      worker.on('message', ready);
    });
  } finally {
    // Reset cluster settings.
    cluster.settings.exec = originalExec;
    cluster.settings.execArgv = originalArgs;
  }
}

export async function waitForError(proc: ChildProcess, port: number): Promise<void> {
  return new Promise((_, reject) => {
    proc.once("error", reject);
    proc.once("exit", (code) => {
      reject(new Error(`Process exited with code ${code} while waiting for server to start on port "${port}".`));
    });
  })
}

export async function waitForServer(port: number, wait: number = 0): Promise<Socket> {
  let remaining = wait > 0 ? wait : Infinity;
  let connection: Socket | null;
  while (!(connection = await getConnection(port))) {
    if (remaining >= 100) {
      remaining -= 100;
      await sleep(100);
    } else {
      throw new Error(
        `Timeout while wating for server to start on port "${port}".`
      );
    }
  }
  return connection;
}

export async function waitForWorker(worker: Worker, port: number) {
  return new Promise<void>((resolve, reject) => {
    function listening(address: Address) {
      if (address.port === port) {
        worker.off("listening", listening);
        resolve();
      }
    }
    worker
      .on("listening", listening)
      .once("error", reject)
      .once("exit", (code) => {
        reject(
          new Error(
            `Worker exited with code ${code} while waiting for dev server to start on port "${port}".`
          )
        );
      });
  });
}

export async function getConnection(port: number): Promise<Socket | null> {
  return new Promise((resolve) => {
    const connection = net
      .connect(port)
      .setNoDelay(true)
      .setKeepAlive(false)
      .on("error", () => {
        connection.end();
        resolve(null);
      })
      .on("connect", () => {
        resolve(connection)
      });
  });
}

export async function isPortInUse(port: number): Promise<boolean> {
  return Boolean(await getConnection(port));
}

export async function getAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer().listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
