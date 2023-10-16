import { drawMarkoLogo } from "../utils/log";

describe("console", () => {

  describe("logo", () => {

    function print({ lines, width }: { lines: string[], width: number }) {
      console.log(lines.join('|\n') + '|')
      console.log(' '.repeat(width) + '^' + width + '\n')
    }

    it("should draw", () => {
      print(drawMarkoLogo(true, true));
      print(drawMarkoLogo(true, false));
      print(drawMarkoLogo(false, true));
      print(drawMarkoLogo(false, false));
    });
  });

});
