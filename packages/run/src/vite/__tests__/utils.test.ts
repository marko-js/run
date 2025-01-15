import assert from "assert";

import { getInspectOptions } from "../utils/server";

describe("server-utils", () => {
  describe("extractInspectArgs", () => {
    it("should extract --inspect with no value", () => {
      const args = ["--inspect"];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: undefined,
        port: undefined,
        wait: false,
      });
    });

    it("should extract --inspect with host and port", () => {
      const expectedPort = 9229;
      const args = [`--inspect=${expectedPort}`];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: undefined,
        port: expectedPort,
        wait: false,
      });
    });

    it("should extract --inspect with host and port", () => {
      const expectedHost = "http://localhost";
      const expectedPort = 9229;
      const args = [`--inspect=${expectedHost}:${expectedPort}`];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: expectedHost,
        port: expectedPort,
        wait: false,
      });
    });

    it("should extract --inspect with host and port", () => {
      const expectedHost = "http://localhost";
      const expectedPort = 9229;
      const args = [`--inspect=${expectedHost}:${expectedPort}`];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: expectedHost,
        port: expectedPort,
        wait: false,
      });
    });

    it("should extract --inspect and ignore invalid value", () => {
      const args = [`--inspect=blah`];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: undefined,
        port: undefined,
        wait: false,
      });
    });

    it("should extract --inspect-brk with no value", () => {
      const args = ["--inspect-brk"];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: undefined,
        port: undefined,
        wait: true,
      });
    });

    it("should extract --inspect-brk with host and port", () => {
      const expectedPort = 9229;
      const args = [`--inspect-brk=${expectedPort}`];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: undefined,
        port: expectedPort,
        wait: true,
      });
    });

    it("should extract --inspect-brk with host and port", () => {
      const expectedHost = "http://localhost";
      const expectedPort = 9229;
      const args = [`--inspect-brk=${expectedHost}:${expectedPort}`];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: expectedHost,
        port: expectedPort,
        wait: true,
      });
    });

    it("should extract --inspect-brk with host and port", () => {
      const expectedHost = "http://localhost";
      const expectedPort = 9229;
      const args = [`--inspect-brk=${expectedHost}:${expectedPort}`];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: expectedHost,
        port: expectedPort,
        wait: true,
      });
    });

    it("should extract --inspect-brk and ignore invalid value", () => {
      const args = [`--inspect-brk=blah`];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: undefined,
        port: undefined,
        wait: true,
      });
    });

    it("should prefer first argument", () => {
      const expectedHost = "http://localhost";
      const expectedPort = 9229;
      const args = [
        `--inspect=${expectedHost}:${expectedPort}`,
        `--inspect-brk=foo:1234`,
      ];
      const actual = getInspectOptions(args);

      assert.deepEqual(actual, {
        host: expectedHost,
        port: expectedPort,
        wait: false,
      });
    });
  });
});
