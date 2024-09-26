import supporsColor from "supports-color";
import kleur from "kleur";
import type { Rollup } from "vite";

type RollupError = Rollup.RollupError;

function stripAnsi(string: string) {
  return string.replace(
    /([\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><])/g,
    "",
  );
}

function cleanStack(stack: string) {
  return stack
    .split(/\n/)
    .filter((l) => /^\s*at/.test(l))
    .join("\n");
}

export function prepareError(err: Error | RollupError) {
  return {
    message: stripAnsi(err.message),
    stack: stripAnsi(cleanStack(err.stack || "")),
    id: (err as RollupError).id,
    frame: stripAnsi((err as RollupError).frame || ""),
    plugin: (err as RollupError).plugin,
    pluginCode: (err as RollupError).pluginCode?.toString(),
    loc: (err as RollupError).loc,
  };
}

export function logInfoBox(address: string, explorer?: string) {
  const color = !!supporsColor.stdout;

  let message = kleur.bold("Marko Run");
  if (process.env.npm_package_version !== "") {
    message += ` v${process.env.npm_package_version}`;
  }
  message += "\n\n";
  message += kleur.dim("Server listening at");
  message += "\n";
  message += kleur.cyan(kleur.underline(address));

  if (explorer) {
    message += "\n\n";
    message += kleur.dim("Explore your routes");
    message += "\n";
    message += kleur.dim(kleur.green(kleur.underline(explorer)));
  }

  const lines = drawMarkoBox(message, { color, fill: color });
  console.log(lines.join("\n") + '\n');
}

export function drawMarkoBox(message: string, options?: LogoOptions) {
  const textPaddingWidth = 3;
  const logoPaddingWidth = 2;
  const textPadding = " ".repeat(textPaddingWidth);
  const logoPadding = " ".repeat(logoPaddingWidth);

  const logo = drawMarkoLogo(options);

  const textLines = message.split(/\n/);
  const textWidths = textLines.map(
    (line) => line.replace(/\x1b\[\d+m/g, "").length
  );
  const textWidth = Math.max(...textWidths);

  const height = Math.max(textLines.length + 2, logo.lines.length);
  const width = textPaddingWidth * 2 + logoPaddingWidth + textWidth + logo.width;
  const hBorder = "─".repeat(width);
  const vBorder = "│";

  const lineDiff = logo.lines.length - textLines.length;
  const textStartLine = lineDiff > 0 ? Math.max(Math.floor(lineDiff / 2), 1) : 1;
  const textEndLine = height - (lineDiff > 0 ? Math.ceil(lineDiff / 2) : 1);
  const logoEndLine = logo.lines.length;
  const logoFill = " ".repeat(logo.width);
  const textFill = " ".repeat(textWidth);

  const lines = [`╭${hBorder}╮`];

  for (let i = 0; i < height; i++) {
    let line = vBorder;
    line += logoPadding;
    if (i < logoEndLine) {
      line += logo.lines[i];
    } else {
      line += logoFill;
    }
    line += textPadding;
    if (i >= textStartLine && i < textEndLine) {
      let index = i - textStartLine;
      line += textLines[index];
      line += " ".repeat(textWidth - textWidths[index]);
    } else {
      line += textFill;
    }
    line += textPadding;
    line += vBorder;
    lines.push(line);
  }

  lines.push(`╰${hBorder}╯`);

  return lines;
}

export interface LogoOptions {
  fill?: boolean;
  color?: boolean;
}

export function drawMarkoLogo(options: LogoOptions = {}) {
  const { fill = true, color = true } = options;
  const source = `
   TT____  YY____  R____
  C╱T╲   ╲G╱Y╲   ╲ R╲   ╲
 C╱  T╲  G╱  Y╲   ╲ R╲   ╲
C╱   ╱T╲G╱   ╱Y╲   ╲ R╲   ╲
B╲   ╲ GG‾‾‾‾ O╱   ╱ P╱   ╱
 B╲   ╲    OOO╱   ╱ P╱   ╱
  B╲   ╲  OOO╱   ╱ P╱   ╱
   B‾‾‾‾  OOO‾‾‾‾  P‾‾‾‾
`;

  const resetEscape = "\x1b[0m";
  const colorEscapeCodes = Object.entries({
    B: "#06cfe5",
    C: "#05a5f0",
    T: "#19d89c",
    G: "#81dc09",
    Y: "#ffd900",
    O: "#ff9500",
    R: "#f3154d",
    P: "#ce176c",
  }).reduce((acc, [key, hex]) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    acc[key] = `\x1b[38;2;${r};${g};${b}m`;
    return acc;
  }, {} as Record<string, string>);

  const lines = [];
  const lineWidths = [];

  let line = "";
  let lineWidth = 0;
  let width = 0;

  for (let i = 0; i < source.length; i++) {
    let char = source[i];
    if (char === "\n") {
      if (line) {
        if (color) {
          line += resetEscape;
        }
        width = Math.max(lineWidth, width);
        lines.push(line);
        lineWidths.push(lineWidth);
        line = "";
        lineWidth = 0;
      }
    } else if (/[A-Z]/.test(char)) {
      while (source[i + 1] === char) i++;

      if (color) {
        line += colorEscapeCodes[char];
      }
      if (fill) {
        let fillChar = "";
        for (; i < source.length; i++) {
          char = source[i + 1];
          if (fillChar && char !== " ") {
            break;
          } else if (!fillChar) {
            fillChar = char;
          }
          line += fillChar;
          lineWidth++;
        }
      }
    } else {
      line += char;
      lineWidth++;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const padding = width - lineWidths[i];
    if (padding > 0) {
      lines[i] += " ".repeat(width - lineWidths[i]);
    }
  }

  return { lines, width };
}
