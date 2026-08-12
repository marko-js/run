import assert from "assert";

import {
  mergeOptions,
  normalizeHandler,
  normalizeOptions,
} from "../runtime/internal";

describe("normalizeOptions", () => {
  it("should enable body parsing with the defaults for a bare truthy option", () => {
    // The types forbid `json: true`, but plain-JS handlers have no type
    // guard and it is the natural way to write "parse the body".
    const { json, form } = normalizeOptions("POST", {
      json: true,
      form: true,
    } as any);

    assert.equal(json!.maxBytes, 1024 * 1024);
    assert.equal(json!.validator, undefined);
    assert.equal(form!.maxFiles, 20);
    assert.equal(form!.maxParts, 1000);
    assert.equal(form!.validator, undefined);
  });

  it("should treat a function as the validator", () => {
    const validator = (input: unknown) => [input, undefined];
    const { json } = normalizeOptions("POST", { json: validator } as any);

    assert.equal(json!.validator, validator);
    assert.equal(json!.maxBytes, 1024 * 1024);
  });

  it("should treat a Standard Schema as the validator", () => {
    const schema = {
      "~standard": { validate: (value: unknown) => ({ value }) },
    };
    const { form } = normalizeOptions("POST", { form: schema } as any);

    assert.equal(typeof form!.validator, "function");
  });

  it("should drop a validator that is neither a function nor a schema", () => {
    // Wrapping one would defer the crash to the first validation.
    const { params, search, json, form } = normalizeOptions("POST", {
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
    const { params, search } = normalizeOptions("GET", {
      params: fn,
      search: schema,
    } as any);

    assert.equal(params, fn);
    assert.deepEqual(search!({ page: "2" }), [{ page: 2 }, undefined]);
    assert.deepEqual(search!({}), [{}, issues]);
  });

  it("should combine json options across sources with later sources winning", () => {
    const validator = (input: unknown) => [input, undefined];
    const { json, form } = normalizeOptions(
      "POST",
      { json: { maxBytes: 5 }, form: { maxFiles: 1 } } as any,
      { json: { validator } } as any,
    );

    assert.equal(json!.maxBytes, 5);
    assert.equal(json!.validator, validator);
    assert.equal(form!.maxFiles, 1);
  });
});

describe("mergeOptions", () => {
  it("should not mutate the source options", () => {
    // A root +middleware's options object is a module-scoped singleton merged
    // into every route below it.
    const middleware = { json: { maxBytes: 100 } };
    const validator = (input: unknown) => [input, undefined];
    mergeOptions([middleware, { json: { validator } }]);

    assert.deepEqual(middleware, { json: { maxBytes: 100 } });
  });

  it("should keep a middleware validator when the handler sets only limits", () => {
    const validator = (input: unknown) => [input, undefined];
    const middleware = { json: { validator, maxBytes: 100 } };
    const handler = (Run.POST as any)({ json: { maxBytes: 200 } }, () => {});
    const { json } = normalizeOptions("POST", middleware as any, handler);

    assert.equal(json!.validator, validator);
    assert.equal(json!.maxBytes, 200);
  });

  it("should merge a bare validator with an options object", () => {
    const validator = (input: unknown) => [input, undefined];
    const { json } = normalizeOptions(
      "POST",
      { json: { maxBytes: 100 } } as any,
      { json: validator } as any,
    );

    assert.equal(json!.validator, validator);
    assert.equal(json!.maxBytes, 100);
  });

  it("should let an explicitly present undefined key override an inherited option", () => {
    const validator = (input: unknown) => [input, undefined];
    const { json, search } = normalizeOptions(
      "POST",
      { json: validator, search: validator } as any,
      { json: undefined } as any,
    );

    assert.equal(json, undefined);
    assert.equal(typeof search, "function");
  });

  it("should leave inherited options alone when the key is absent", () => {
    const validator = (input: unknown) => [input, undefined];
    const { json } = normalizeOptions(
      "POST",
      { json: validator } as any,
      {} as any,
    );

    assert.equal(typeof json!.validator, "function");
  });

  it("should not leak one route's options into a sibling merge", () => {
    const middleware = { json: { maxBytes: 100 } };
    const validator = (input: unknown) => [input, undefined];
    const routeA = normalizeOptions(
      "POST",
      middleware as any,
      {
        json: { validator },
      } as any,
    );
    const routeB = normalizeOptions("POST", middleware as any, {} as any);

    assert.equal(routeA.json!.validator, validator);
    assert.equal(routeB.json!.validator, undefined);
    assert.equal(routeB.json!.maxBytes, 100);
  });
});

describe("normalizeOptions verb gating", () => {
  it("should skip options from inputs stamped with a different verb", () => {
    const validator = (input: unknown) => [input, undefined];
    const middleware = (Run.POST as any)({ search: validator }, () => {});
    const { search } = normalizeOptions("GET", middleware);

    assert.equal(search, undefined);
  });

  it("should keep options from matching, ALL, and unstamped inputs", () => {
    const validator = (input: unknown) => [input, undefined];
    const all = (Run.ALL as any)({ json: validator }, () => {});
    const post = (Run.POST as any)({ form: true }, () => {});
    const { json, form, search } = normalizeOptions("POST", all, post, {
      search: validator,
    } as any);

    assert.equal(typeof json!.validator, "function");
    assert.notEqual(form, undefined);
    assert.equal(typeof search, "function");
  });

  it("should apply GET-stamped options to HEAD", () => {
    const validator = (input: unknown) => [input, undefined];
    const get = (Run.GET as any)({ search: validator }, () => {});
    const { search } = normalizeOptions("HEAD", get);

    assert.equal(typeof search, "function");
  });
});

describe("array export options", () => {
  it("should surface options declared inside an array export", () => {
    const validator = (input: unknown) => [input, undefined];
    const composed = normalizeHandler([
      (Run.POST as any)({ json: validator }, () => {}),
      () => {},
    ] as any);
    const { json } = normalizeOptions("POST", composed as any);

    assert.equal(typeof json!.validator, "function");
  });

  it("should gate array elements by their own verb stamps", () => {
    const validator = (input: unknown) => [input, undefined];
    const composed = normalizeHandler([
      (Run.GET as any)({ search: validator }, () => {}),
      (Run.POST as any)({ form: true }, () => {}),
    ] as any);

    const get = normalizeOptions("GET", composed as any);
    assert.equal(typeof get.search, "function");
    assert.equal(get.form, undefined);

    const post = normalizeOptions("POST", composed as any);
    assert.equal(post.search, undefined);
    assert.notEqual(post.form, undefined);
  });

  it("should not stamp a shared handler reused in single-element arrays", () => {
    const shared = () => {};
    const get = (Run.GET as any)([shared]);
    const post = (Run.POST as any)([shared]);

    assert.equal((shared as any).verb, undefined);
    assert.equal((shared as any).options, undefined);
    assert.equal(get.verb, "GET");
    assert.equal(post.verb, "POST");
  });
});
