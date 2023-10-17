import { drawMarkoBox, drawMarkoLogo, logInfoBox } from "../adapter/utils";

describe("adapter-utils", () => {
  describe("marko-logo", () => {
    function print({ lines, width }: { lines: string[]; width: number }) {
      console.log(lines.join("|\n") + "|");
      console.log(" ".repeat(width) + "^" + width + "\n");
    }

    it("should draw", () => {
      print(drawMarkoLogo({ fill: true, color: true }));
      print(drawMarkoLogo({ fill: true, color: false }));
      print(drawMarkoLogo({ fill: false, color: true }));
      print(drawMarkoLogo({ fill: false, color: false }));
    });
  });

  describe("marko-box", () => {
    function print(lines: string[]) {
      console.log(lines.join("\n"));
    }

    it("should draw", () => {
      const message =
        "Marko Run\n\nHello\nWorld";
      print(drawMarkoBox(message, { fill: true, color: true }));
      print(drawMarkoBox(message, { fill: true, color: false }));
      print(drawMarkoBox(message, { fill: false, color: true }));
      print(drawMarkoBox(message, { fill: false, color: false }));
    });

    it("should vertically center short messages", () => {
      const message =
        "This is a vertically short but pretty horizontally wide message";
      print(drawMarkoBox(message));
    });

    it("should vertically align the logo to the top", () => {
      const message =
        "This\n\nis a\n\nreally\n\nquite\n\nvertically\n\ntall\n\nmessage";
      print(drawMarkoBox(message));
    });
  });

  describe("info-box", () => {
    it("should log", () => {
      logInfoBox("https://localhost:3000");
    });
  });
});
