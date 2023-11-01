import kleur from "kleur";
import type { NodeMiddleware } from "./middleware";
import { IncomingMessage, ServerResponse } from "http";
import DraftLog from "draftlog";
import format from "human-format";
import inpspector from "inspector";

if (!inpspector.url()) {
  DraftLog.into(console);
  (DraftLog as any).defaults.canReWrite = false;
}

const HttpStatusColors = [
  "", // Unused
  "green", // 1xx
  "green", // 2xx
  "cyan", // 3xx
  "yellow", // 4xx
  "red", // 5xx
] as const;

const IdChars = [
  "",
  kleur.cyan("¹"),
  kleur.magenta("²"),
  kleur.green("³"),
  kleur.red("⁴"),
  kleur.cyan("⁵"),
  kleur.magenta("⁶"),
  kleur.green("⁷"),
  kleur.red("⁸"),
  kleur.cyan("⁹"),
  kleur.red("⁺"),
];
const ArrowSteps = ["   ", "  ◀", " ◀━", "◀━━", "━━ ", "━  ", "   "];

export interface LoggerOptions {}

export default function (_options: LoggerOptions = {}): NodeMiddleware {
  let inFlight = 0;
  
  return function logger(req, res, next) {
    let startTime = Date.now();

    const handleFinish = () => done("finish");
    const handleClose = () => done("close");

    res.on("finish", handleFinish);
    res.on("close", handleClose);

    const bitMask = ~inFlight & (inFlight + 1);
    const index = Math.log2(bitMask);
    const id = IdChars[index];

    if (index < IdChars.length) {
      inFlight |= bitMask;
    }

    const finalizeLog = logRequest(id, req);

    let bodyLength = 0;

    const _write = res.write;
    const _end = res.end;

    res.write = ((...args) => {
      if (typeof args[1] !== "function") {
        bodyLength += Buffer.byteLength(args[0], args[1]);
      } else {
        bodyLength += args[0].length;
      }
      return _write.apply(res, args as any);
    }) as typeof _write;

    res.end = ((...args) => {
      if (args.length && typeof args[0] !== 'function') {
        if (typeof args[1] !== 'function') {
          bodyLength += Buffer.byteLength(args[0], args[1] as BufferEncoding);
        } else {
          bodyLength += args[0].length
        }
      }
      return _end.apply(res, args as any)
    }) as typeof _end;

    next?.();

    function done(event: string) {
      res.off("finish", handleFinish);
      res.off("close", handleClose);

      finalizeLog();

      if (index < 10) {
        inFlight ^= bitMask;
      }

      const contentLength = (res.getHeader("content-length") || 0) as number;

      logResponse(
        id,
        req,
        res,
        startTime,
        contentLength || bodyLength,
        event === "finish"
      );
    }
  };
}

let spinners: ReturnType<typeof createAnimationManager>;

function logRequest(id: string, req: IncomingMessage) {
  const info = id + " " + kleur.bold(req.method!) + " " + kleur.dim(req.url!);
  const final = kleur.dim(requestArrow(id)) + info;

  if (console.draft) {
    spinners ??= createAnimationManager({ steps: ArrowSteps.length })
    const update = console.draft();
    const stop = spinners.add((step) => {
      update(kleur.cyan(requestArrow(id, step)) + info);
    });

    return () => {
      stop();
      update(final);
    };
  }

  console.log(final);
  return () => {};
}

function logResponse(
  id: string,
  req: IncomingMessage,
  res: ServerResponse,
  startTime: number,
  contentLength: number,
  success: boolean
) {
  const status = res.statusCode;
  const color = HttpStatusColors[(status / 100) | 0] || "red";

  let length: string;
  if (req.method === "HEAD" || [204, 205, 304].includes(status)) {
    length = "";
  } else if (!contentLength) {
    length = kleur.dim("-");
  } else {
    length = formatMeasurement(bytes(contentLength));
  }

  let arrow = id ? "━" : "━━";
  if (success) {
    arrow = kleur.dim(arrow + "▶");
  } else {
    arrow = kleur.red(kleur.dim(arrow) + kleur.bold("x"));
  }

  console.log(
    arrow +
      id +
      " " +
      kleur.bold(req.method!) +
      " " +
      kleur.dim(req.url!) +
      " " +
      kleur[color](status) +
      " " +
      formatMeasurement(time(startTime)) +
      " " +
      length
  );
}

function requestArrow(id?: string, step: number = 3) {
  const arrow = ArrowSteps[step];
  return id ? arrow.slice(0, -1) : arrow;
}

function time(start: number): [string | number, string] {
  const delta = Date.now() - start;
  return delta < 5000 ? [delta, "ms"] : [(delta / 1000).toFixed(1), "s"];
}

function bytes(size: number): [string, string] {
  const { value, prefix } = format.raw(size, { maxDecimals: 2, unit: "b" });
  return [value.toFixed(2), (prefix + "b").toLowerCase()];
}

function formatMeasurement([value, unit]: [string | number, string]) {
  return kleur.dim(value + kleur.yellow(kleur.bold(unit)));
}

type Animation = (step: number) => void;

interface AnimationOptions {
  steps?: number;
  ms?: number;
}

function createAnimationManager(options: AnimationOptions = {}) {
  const { steps = 10000, ms = 100 } = options;

  const fns = new Set<Animation>();
  let step = 0;
  let isRunning = false;
  let interval: any;

  function start() {
    step = 0;
    isRunning = true;
    interval = setInterval(() => {
      if (isRunning) {
        for (const fn of fns) {
          fn(step);
        }
        step = (step + 1) % steps;
      }
    }, ms);
  }

  function stop() {
    isRunning = false;
    clearInterval(interval);
  }

  return {
    add(fn: Animation): () => void {
      fns.add(fn);

      if (!isRunning) {
        start();
      }
      fn(step);

      return () => {
        fns.delete(fn);
        if (!fns.size) {
          stop();
        }
      };
    },
  };
}
