import assert from "assert";

import { mergeOptions, normalizeOptions } from "../runtime/internal";

describe("normalizeOptions", () => {
  it("should enable body parsing with the defaults for a bare truthy option", () => {
    // The types forbid `json: true`, but plain-JS handlers have no type
    // guard and it is the natural way to write "parse the body".
    const { json, form } = normalizeOptions({ json: true, form: true } as any);

    assert.equal(json!.maxBytes, 1024 * 1024);
    assert.equal(json!.validator, undefined);
    assert.equal(form!.maxFiles, 20);
    assert.equal(form!.maxParts, 1000);
    assert.equal(form!.validator, undefined);
  });

  it("should treat a function as the validator", () => {
    const validator = (input: unknown) => [input, undefined];
    const { json } = normalizeOptions({ json: validator } as any);

    assert.equal(json!.validator, validator);
    assert.equal(json!.maxBytes, 1024 * 1024);
  });

  it("should treat a Standard Schema as the validator", () => {
    const schema = {
      "~standard": { validate: (value: unknown) => ({ value }) },
    };
    const { form } = normalizeOptions({ form: schema } as any);

    assert.equal(typeof form!.validator, "function");
  });

  it("should drop a validator that is neither a function nor a schema", () => {
    // Wrapping one would defer the crash to the first validation.
    const { params, search, json, form } = normalizeOptions({
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
    const issues = [{ message: "bad" }];
    const schema = {
      "~standard": {
        validate: (value: any) =>
          value.page ? { value: { page: Number(value.page) } } : { issues },
      },
    };
    const { params, search } = normalizeOptions({
      params: fn,
      search: schema,
    } as any);

    assert.equal(params, fn);
    // Only the schema's own `validate` can transform the value, so these pin
    // the wrapper's delegation along with both tuple shapes.
    assert.deepEqual(search!({ page: "1" }), [{ page: 1 }, undefined]);
    assert.deepEqual(search!({}), [{}, issues]);
  });

  it("should take an options object as options", () => {
    const { json, form } = normalizeOptions({
      json: { maxBytes: 5 },
      form: { maxFiles: 2, maxFileBytes: 10 },
    } as any);

    assert.equal(json!.maxBytes, 5);
    assert.equal(form!.maxFiles, 2);
    assert.equal(form!.maxBytes, 20);
  });
});

describe("mergeOptions", () => {
  it("should not mutate the source options", () => {
    // A root +middleware's options object is a module-scoped singleton merged
    // into every route below it.
    const middleware = { json: { maxBytes: 100 } };
    const validator = (input: unknown) => [input, undefined];
    mergeOptions(middleware, { json: { validator } });

    assert.deepEqual(middleware, { json: { maxBytes: 100 } });
  });

  it("should keep a middleware validator when the handler sets only limits", () => {
    const validator = (input: unknown) => [input, undefined];
    const middleware = { json: { validator, maxBytes: 100 } };
    const handler = (Run.POST as any)({ json: { maxBytes: 200 } }, () => {});
    const { json } = normalizeOptions(middleware as any, handler as any);

    assert.equal(json!.validator, validator);
    assert.equal(json!.maxBytes, 200);
  });

  it("should merge a bare validator with an options object", () => {
    const validator = (input: unknown) => [input, undefined];
    const { json } = normalizeOptions(
      { json: { maxBytes: 100 } } as any,
      { json: validator } as any,
    );

    assert.equal(json!.validator, validator);
    assert.equal(json!.maxBytes, 100);
  });

  it("should let an explicitly present undefined key override an inherited option", () => {
    const validator = (input: unknown) => [input, undefined];
    const { json, search } = normalizeOptions(
      { json: validator, search: validator } as any,
      { json: undefined } as any,
    );

    assert.equal(json, undefined);
    assert.equal(typeof search, "function");
  });

  it("should leave inherited options alone when the key is absent", () => {
    const validator = (input: unknown) => [input, undefined];
    const { json } = normalizeOptions({ json: validator } as any, {} as any);

    assert.equal(typeof json!.validator, "function");
  });

  it("should not leak one route's options into a sibling merge", () => {
    const middleware = { json: { maxBytes: 100 } };
    const validator = (input: unknown) => [input, undefined];
    const routeA = normalizeOptions(
      middleware as any,
      { json: { validator } } as any,
    );
    const routeB = normalizeOptions(middleware as any, {} as any);

    assert.equal(routeA.json!.validator, validator);
    assert.equal(routeB.json!.validator, undefined);
    assert.equal(routeB.json!.maxBytes, 100);
  });
});
