import assert from "assert";

import { createContext } from "../runtime/internal";

function back(referer?: string) {
  const request = new Request("http://site.example/form", {
    headers: referer === undefined ? {} : { referer },
  });
  return createContext(null, request, {}).back("/home").headers.get("location");
}

describe("Context Back", () => {
  it("should redirect to a referer from the same origin", () => {
    assert.equal(
      back("http://site.example/list?page=2"),
      "http://site.example/list?page=2",
    );
  });

  it("should redirect to the fallback for a referer from another origin", () => {
    assert.equal(back("https://evil.example/x"), "http://site.example/home");
  });

  it("should redirect to the fallback without a referer", () => {
    assert.equal(back(), "http://site.example/home");
  });

  it("should redirect to the fallback for a referer that is not a URL", () => {
    assert.equal(back("/list"), "http://site.example/home");
  });
});
