import net from "net";
import cp from "child_process";
import { parse, config } from 'dotenv';
import fs from "fs";

export interface SpawnedServer {
  port: number,
  close(): void
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
  port: number = 0,
  env?: string | Record<string, string>,
  cwd: string = process.cwd(),
  wait: number = 30_000
): Promise<SpawnedServer> {
  if (port <= 0) {
    port = await getAvailablePort();
  }

  if (typeof env === 'string') {
    env = await parseEnv(env);
  }

  const proc = cp.spawn(cmd, {
    cwd,
    shell: true,
    stdio: "inherit",
    windowsHide: true,
    env: { ...env, NODE_ENV: "development", ...process.env, PORT: `${port}` },
  });

  const close = () => {
    proc.unref();
    proc.kill();
  };

  let remaining = wait > 0 ? wait : Infinity;
  while (!(await isPortInUse(port))) {
    if (remaining >= 100) {
      remaining -= 100;
      await sleep(100);
    } else {
      close();
      throw new Error(
        `site-write: timeout while wating for server to start on port "${port}".`
      );
    }
  }

  return {
    port,
    close
  };
}

export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const connection = net
      .connect(port)
      .setNoDelay(true)
      .setKeepAlive(false)
      .on("error", () => done(false))
      .on("connect", () => done(true));
    function done(connected: boolean) {
      connection.end();
      resolve(connected);
    }
  });
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
