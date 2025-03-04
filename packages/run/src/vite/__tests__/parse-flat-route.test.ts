import assert from "assert";

import { parseFlatRoute } from "../routes/parse";

describe("parse-flat-route", () => {
  it("should work for a single static segment", () => {
    const actual = parseFlatRoute("a");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["a"],
    );
  });

  it("segments starting with `$` indicate dynamic segment", () => {
    const actual = parseFlatRoute("$");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["$"],
    );
  });

  it("should extract the param for a named dynamic segment", () => {
    const actual = parseFlatRoute("$id");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["$"],
    );
    assert.deepEqual(actual[0].segments[0].param, "id");
  });

  it("segments starting with `_` indicate a pathless route", () => {
    const actual = parseFlatRoute("_abc,_def,_,");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["_abc", "_def", "_", ""],
    );
  });

  it("should treat `.` as a nested directory", () => {
    const actual = parseFlatRoute("a.b.c");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["a/b/c"],
    );
  });

  it("should split on `,` into separate paths", () => {
    const actual = parseFlatRoute("a.b.c,d.e.f,h");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["a/b/c", "d/e/f", "h"],
    );
  });

  it("should group on `(` and `)` one level at the end", () => {
    const actual = parseFlatRoute("a.(b,c,d)");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["a/b", "a/c", "a/d"],
    );
  });

  it("should group one level with continuation", () => {
    const actual = parseFlatRoute("a.(b,c,d).e");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["a/b/e", "a/c/e", "a/d/e"],
    );
  });

  it("groups only open at the beginning or after `.` and `,`", () => {
    const actual = parseFlatRoute("a(,(b,c).d,e.$(");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["a(", "b/d", "c/d", "e/$"],
    );
    assert.deepEqual(actual[3].segments[1].param, "(");
  });

  it("should group many levels", () => {
    const actual = parseFlatRoute("a.(b,c.(e,f.(g,h)).i).j");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["a/b/j", "a/c/e/i/j", "a/c/f/g/i/j", "a/c/f/h/i/j"],
    );
  });

  it("should preserve pathless segments", () => {
    const actual = parseFlatRoute("($a,_).(_,$b)");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.name).join("/")),
      ["$/_", "_/_", "$/$", "_/$"],
    );
  });

  it("should work for optional nested dynamic segments", () => {
    const actual = parseFlatRoute("($a,).$b");
    assert.deepEqual(
      actual.map((path) => path.segments.map((s) => s.raw).join("/")),
      ["$a/$b", "$b"],
    );
  });

  it("should thow for ambiguous hoisting", () => {
    assert.throws(
      () => parseFlatRoute("(a,).(,a)"),
      (err: Error) => err.message.startsWith("Invalid route pattern"),
    );
  });

  it("should throw when defining multiple dynamic segments", () => {
    assert.throws(
      () => parseFlatRoute("$,$a"),
      (err: Error) => err.message.startsWith("Invalid route pattern"),
    );
  });

  it("should throw when defining ambiguous dynamic segments", () => {
    assert.throws(
      () => parseFlatRoute("($a,).(,$b)"),
      (err: Error) => err.message.startsWith("Invalid route pattern"),
    );
  });

  it("should throw when nested segments are added to a catch-all", () => {
    assert.throws(
      () => parseFlatRoute("a.(b,$$).c"),
      (err: Error) => err.message.startsWith("Invalid route pattern"),
    );
  });
});
