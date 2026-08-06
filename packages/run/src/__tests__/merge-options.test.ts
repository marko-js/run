import assert from "assert";

import { mergeOptions } from "../runtime/internal";

describe("mergeOptions", () => {
  it("should enable body parsing with the defaults for a bare truthy option", () => {
    // The types forbid `json: true`, but plain-JS handlers have no type
    // guard and it is the natural way to write "parse the body".
    const { json, form } = mergeOptions({ json: true, form: true } as any);

    assert.equal(json!.maxBytes, 1024 * 1024);
    assert.equal(json!.validator, undefined);
    assert.equal(form!.maxFiles, 20);
    assert.equal(form!.maxParts, 1000);
    assert.equal(form!.validator, undefined);
  });

  it("should treat a function as the validator", () => {
    const validator = (input: unknown) => [input, undefined];
    const { json } = mergeOptions({ json: validator } as any);

    assert.equal(json!.validator, validator);
    assert.equal(json!.maxBytes, 1024 * 1024);
  });

  it("should treat a Standard Schema as the validator", () => {
    const schema = {
      "~standard": { validate: (value: unknown) => ({ value }) },
    };
    const { form } = mergeOptions({ form: schema } as any);

    assert.equal(typeof form!.validator, "function");
  });

  it("should drop a validator that is neither a function nor a schema", () => {
    // Wrapping one would defer the crash to the first validation.
    const { params, search, json, form } = mergeOptions({
      params: true,
      search: "yes",
      json: { validator: true },
      form: { validator: 1, maxFiles: 2 },
    } as any);

    assert.equal(params, undefined);
    assert.equal(search, undefined);
    assert.equal(json!.validator, undefined);
    assert.equal(form!.validator, undefined);
    assert.equal(form!.maxFiles, 2);
  });

  it("should normalize params and search validators", () => {
    const fn = (input: unknown) => [input, undefined];
    const schema = {
      "~standard": { validate: (value: unknown) => ({ value }) },
    };
    const { params, search } = mergeOptions({
      params: fn,
      search: schema,
    } as any);

    assert.equal(params, fn);
    assert.equal(typeof search, "function");
  });

  it("should take an options object as options", () => {
    const { json, form } = mergeOptions({
      json: { maxBytes: 5 },
      form: { maxFiles: 2, maxFileBytes: 10 },
    } as any);

    assert.equal(json!.maxBytes, 5);
    assert.equal(form!.maxFiles, 2);
    assert.equal(form!.maxBytes, 20);
  });
});
