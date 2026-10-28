import { expect, type Page, test as browserTest } from "playwright/test";

import { serve } from "./fixtures/server";

const test = browserTest.extend<{
  app: Awaited<ReturnType<typeof serve>>;
  pageErrors: string[];
}>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
  // eslint-disable-next-line no-empty-pattern
  app: async ({}, use) => {
    const app = await serve();
    try {
      await use(app);
    } finally {
      await app.close();
    }
  },
});

test.beforeEach(async ({ page, app }, info) => {
  if (info.project.metadata.base) {
    await page.addInitScript(() => {
      Object.defineProperty(window, "navigation", { value: undefined });
      Reflect.deleteProperty(window, "NavigationPrecommitController");
    });
  }
  await page.addInitScript(() => {
    window.navigation?.addEventListener("navigate", (event) =>
      window.appFirst?.(event),
    );
  });
  await page.goto(app.url + "/r/a");
  await page.waitForFunction(() =>
    window.events?.some((event) => event.type === "ready"),
  );
});

test("engine capabilities match the project", async ({ page }, info) => {
  expect(await page.evaluate(() => !!window.navigation)).toBe(
    !info.project.metadata.base,
  );
  if (!info.project.metadata.base) {
    expect(
      await page.evaluate(() => "NavigationPrecommitController" in window),
    ).toBe(info.project.metadata.precommit);
  }
});

test("link commits at the first flush, redirect uses one entry", async ({
  page,
}) => {
  const before = await page.evaluate(() => history.length);
  await page.click("#redirect");
  await ended(page, "/r/b");
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test("first-flush code sees the committed URL while the response is held", async ({
  page,
  app,
}) => {
  const before = await page.evaluate(() => history.length);
  await page.click("#late");
  await expect
    .poll(() => app.requests.some((r) => r.path === "/r/late"))
    .toBe(true);
  await expect(page).toHaveURL(app.url + "/r/a");
  app.release("first");
  await page.waitForFunction(() =>
    window.events.some((event) => event.type === "frame"),
  );
  expect(
    await page.evaluate(() =>
      window.events
        .filter((event) => event.type === "frame")
        .map((event) => event.url),
    ),
  ).toEqual(["/r/late"]);
  expect(
    await page.evaluate(() =>
      window.events.some((event) => event.type === "end"),
    ),
  ).toBe(false);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  app.release("end");
  await ended(page, "/r/late");
});

// A 204 leaves the page as it is, and its browser navigation ends uncommitted.
test("204 leaves the URL and page untouched", async ({ page, app }) => {
  const before = await page.evaluate(() => history.length);
  await page.click("#nocontent");
  await expect
    .poll(() => app.requests.some((r) => r.path === "/r/nocontent" && r.patch))
    .toBe(true);
  await page.waitForFunction(() => !window.navigation?.transition);
  await expect(page).toHaveURL(app.url + "/r/a");
  await expect(page).toHaveTitle("doc a");
  expect(await page.evaluate(() => history.length)).toBe(before);
});

// A patch that ends before any frame applies leaves the page, and its URL: the
// browser's held navigation fails rather than committing.
test("a patch with no frames leaves the URL and page untouched", async ({
  page,
  app,
}) => {
  const before = await page.evaluate(() => history.length);
  await page.evaluate(() =>
    document
      .querySelector("nav")!
      .insertAdjacentHTML(
        "beforeend",
        '<a id="empty" href="/r/empty">empty</a>',
      ),
  );
  await page.click("#empty");
  await page.waitForFunction(() => window.events.some((e) => e.type === "end"));
  await page.waitForFunction(() => !window.navigation?.transition);
  await expect(page).toHaveURL(app.url + "/r/a");
  await expect(page).toHaveTitle("doc a");
  expect(await page.evaluate(() => history.length)).toBe(before);
});

for (const [selector, path, body] of [
  ["#getb", "/r/search", ""],
  ["#postb", "/r/post", "v=1%262&btn=yes"],
]) {
  test("form " + selector, async ({ page, app }) => {
    await page.click(selector);
    await ended(page, path);
    expect(app.requests.find((r) => r.patch)?.body).toBe(body);
    if (path === "/r/search")
      await expect(page).toHaveURL(app.url + path + "?q=x+y");
  });
}

// The router leaves scripts' navigations to the browser.
for (const action of ["assign", "replace", "navigate", "post", "get"]) {
  test(
    "script navigation loads natively: " + action,
    async ({ page, app }, info) => {
      test.skip(
        action === "navigate" && !!info.project.metadata.base,
        "Navigation API is absent",
      );
      const before = await page.evaluate(() => history.length);
      await page.evaluate((action) => {
        if (action === "post" || action === "get")
          (document.getElementById(action) as HTMLFormElement).submit();
        else if (action === "navigate") window.navigation.navigate("/r/b");
        else location[action as "assign" | "replace"]("/r/b");
      }, action);
      const path =
        action === "post" ? "/r/post" : action === "get" ? "/r/search" : "/r/b";
      await expect(page).toHaveTitle("doc " + path.slice(3));
      expect(app.requests.filter((r) => r.patch)).toHaveLength(0);
      expect(await page.evaluate(() => history.length)).toBe(
        before + (action === "replace" ? 0 : 1),
      );
    },
  );
}

// An app's listener runs before the router's or after it, as the app added it.
const orders = ["app listener first", "router listener first"] as const;
function listen(page: Page, order: (typeof orders)[number], fn: string) {
  return page.evaluate(
    ([first, fn]) => {
      const listener = new Function("event", fn) as (event: Event) => void;
      if (first) window.appFirst = listener;
      else window.navigation.addEventListener("navigate", listener);
    },
    [order === orders[0], fn] as const,
  );
}
// The app's record of a navigate event, and its cancel of one to /r/b.
const seen = `if (event.navigationType !== "traverse")
  window.events.push({ type: "seen", url: new URL(event.destination.url).pathname });`;
const cancelB = `if (new URL(event.destination.url).pathname === "/r/b") {
  window.events.push({ type: "cancel", url: "/r/b" });
  event.preventDefault();
}`;
// Navigates, then patches /r/long: anything the first started has had its turn.
async function control(page: Page) {
  await page.evaluate(() =>
    (document.getElementById("long") as HTMLElement).click(),
  );
  await ended(page, "/r/long");
}
function commits(page: Page) {
  return page.evaluate(() =>
    window.events.filter((e) => e.type === "commit").map((e) => e.url),
  );
}
function go(page: Page, how: string) {
  return how === "link"
    ? page.click("#b")
    : page.evaluate(() => location.assign("/r/b"));
}

// An app that cancels a link's navigation gets nothing: where the browser holds
// it before its commit, its patch starts only once no listener canceled it.
for (const order of orders) {
  test(`app canceling a link leaves the page: ${order}`, async ({
    page,
    app,
  }, info) => {
    test.skip(
      !!info.project.metadata.base || !info.project.metadata.precommit,
      "Requires precommit hold",
    );
    await listen(page, order, cancelB);
    await page.click("#b");
    await control(page);
    expect(await commits(page)).toEqual(["/r/long"]);
    expect(app.requests.some((r) => r.path === "/r/b")).toBe(false);
    expect(
      await page.evaluate(
        () => window.events.filter((e) => e.type === "cancel").length,
      ),
    ).toBe(1);
  });
}

// A canceled navigation leaves the patch under way streaming, as a canceled
// navigation leaves a document load.
for (const how of ["link", "assign"]) {
  for (const order of orders) {
    test(`app canceling a navigation leaves the stream running: ${how}, ${order}`, async ({
      page,
      app,
    }, info) => {
      test.skip(!!info.project.metadata.base, "No Navigation API");
      test.skip(
        how === "link" && !info.project.metadata.precommit,
        "The link's request supersedes before the app sees its commit",
      );
      await page.click("#slow");
      await expect(page).toHaveTitle("patched");
      await listen(page, order, cancelB);
      await go(page, how);
      await page.waitForFunction(() =>
        window.events.some((e) => e.type === "cancel"),
      );
      app.release("end");
      await ended(page, "/r/slow");
      await expect(page).toHaveURL(app.url + "/r/slow");
      expect(app.requests.some((r) => r.path === "/r/b")).toBe(false);
      expect(
        await page.evaluate(() => window.events.some((e) => e.type === "stop")),
      ).toBe(false);
    });
  }
}

// A guard that cancels the router's navigation and starts its own gets that
// one from the browser: the router patches only the navigation it started.
for (const [id, path] of [
  ["b", "/r/b"],
  ["postb", "/r/post"],
]) {
  for (const order of orders) {
    test(`app's guard redirect loads its own URL: ${path}, ${order}`, async ({
      page,
      app,
    }, info) => {
      test.skip(
        !!info.project.metadata.base || !info.project.metadata.precommit,
        "Requires precommit hold",
      );
      await listen(
        page,
        order,
        `if (new URL(event.destination.url).pathname === "${path}") {
          event.preventDefault();
          location.assign("/r/long");
        }`,
      );
      const loaded = app.requests.length;
      await page.click("#" + id);
      await expect(page).toHaveTitle("doc long");
      expect(
        app.requests
          .slice(loaded)
          .map((r) => r.method + " " + r.path + (r.patch ? " patch" : "")),
      ).toEqual(["GET /r/long"]);
    });
  }
}

test("412 resubmits natively", async ({ page, app }) => {
  await page.click("#staleb");
  await expect(page).toHaveTitle("doc stale-native");
  const posts = app.requests.filter((r) => r.path === "/r/stale");
  expect(posts.map((r) => r.patch)).toEqual([true, false]);
  for (const post of posts) expect(post.body).toBe("v=s");
});

test("non-patch response loads the document", async ({ page, app }) => {
  await page.click("#notpatch");
  await expect(page).toHaveTitle("doc notpatch");
  expect(
    app.requests.filter((r) => r.path === "/r/notpatch").map((r) => r.patch),
  ).toEqual([true, false]);
});

test("supersede before commit records only the winner", async ({
  page,
  app,
}) => {
  const before = await page.evaluate(() => history.length);
  await page.click("#late");
  await expect
    .poll(() => app.requests.some((r) => r.path === "/r/late"))
    .toBe(true);
  await page.evaluate(() => (window.pauseFrame = true));
  app.release("first");
  await page.waitForFunction(() =>
    window.events.some((e) => e.type === "held" && e.url === "/r/late"),
  );
  await page.click("#b");
  await ended(page, "/r/b");
  await page.evaluate(() => window.releaseFrame!());
  await page.waitForFunction(() =>
    window.events.some((e) => e.type === "discard" && e.url === "/r/late"),
  );
  app.release("end");
  await expect(page.locator("#first")).toHaveText("b");
  await expect(page.locator("#target")).toHaveCount(1);
  await expect(page.locator("#target")).toHaveText("end b");
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  expect(
    await page.evaluate(() =>
      window.events.filter((e) => e.type === "commit").map((e) => e.url),
    ),
  ).toEqual(["/r/b"]);
});

test("supersede mid-stream stops applying the old response", async ({
  page,
  app,
}) => {
  await page.click("#slow");
  await expect(page).toHaveTitle("patched");
  await page.evaluate(() => (window.pauseFrame = true));
  app.release("end");
  await page.waitForFunction(() =>
    window.events.some((e) => e.type === "held" && e.url === "/r/slow"),
  );
  await page.click("#b");
  await ended(page, "/r/b");
  await page.evaluate(() => window.releaseFrame!());
  await page.waitForFunction(() =>
    window.events.some((e) => e.type === "discard" && e.url === "/r/slow"),
  );
  await expect(page.locator("#first")).toHaveText("b");
  await expect(page.locator("#target")).toHaveCount(1);
  await expect(page.locator("#target")).toHaveText("end b");
});

test("loading transition spans the wait and the stream", async ({
  page,
  app,
}, info) => {
  test.skip(
    !!info.project.metadata.base,
    "Base router has no browser transition",
  );
  await page.click("#late");
  await expect
    .poll(() => app.requests.some((r) => r.path === "/r/late"))
    .toBe(true);
  expect(await page.evaluate(() => !!window.navigation.transition)).toBe(
    info.project.metadata.precommit,
  );
  app.release("first");
  await expect(page).toHaveTitle("patched");
  expect(await page.evaluate(() => !!window.navigation.transition)).toBe(true);
  app.release("end");
  await ended(page, "/r/late");
  await page.waitForFunction(() => !window.navigation.transition);
});

test("a fragment link shows loading after its target arrives", async ({
  page,
  app,
}, info) => {
  test.skip(
    !!info.project.metadata.base,
    "Base router has no browser transition",
  );
  await page.evaluate(() =>
    document
      .querySelector("nav")!
      .insertAdjacentHTML(
        "beforeend",
        '<a id="slowfirst" href="/r/slow#first">slow first</a>',
      ),
  );
  await page.click("#slowfirst");
  await expect(page.locator(":target")).toHaveAttribute("id", "first");
  expect(await page.evaluate(() => !!window.navigation.transition)).toBe(true);
  app.release("end");
  await ended(page, "/r/slow");
  await page.waitForFunction(() => !window.navigation.transition);
  await expect(page).toHaveURL(app.url + "/r/slow#first");
});

test("native stop before commit leaves the page", async ({
  page,
  app,
}, info) => {
  test.skip(
    !!info.project.metadata.base || !info.project.metadata.precommit,
    "Requires precommit hold",
  );
  await page.click("#late");
  await expect
    .poll(() => app.requests.some((r) => r.path === "/r/late"))
    .toBe(true);
  await page.evaluate(() => window.stop());
  await page.waitForFunction(() =>
    window.events.some((e) => e.type === "stop"),
  );
  app.release("first");
  app.release("end");
  await expect(page).toHaveURL(app.url + "/r/a");
  await expect(page).toHaveTitle("doc a");
});

test("native stop mid-stream keeps the partial page", async ({
  page,
  app,
}, info) => {
  test.skip(
    !!info.project.metadata.base,
    "Base router falls back after a stopped stream",
  );
  await page.click("#slow");
  await expect(page).toHaveTitle("patched");
  await page.evaluate(() => window.stop());
  await page.waitForFunction(() =>
    window.events.some((e) => e.type === "stop"),
  );
  app.release("end");
  await expect(page).toHaveURL(app.url + "/r/slow");
  await expect(page.locator("#first")).toHaveText("slow");
  await expect(page.locator("#target")).toHaveCount(0);
});

test("fragment before commit keeps the pending patch", async ({
  page,
  app,
}) => {
  await page.click("#late");
  await expect
    .poll(() => app.requests.some((r) => r.path === "/r/late"))
    .toBe(true);
  await page.click("#fragment");
  await expect(page).toHaveURL(app.url + "/r/a#top");
  app.release("first");
  await expect(page).toHaveTitle("patched");
  app.release("end");
  await ended(page, "/r/late");
});

test("fragment mid-stream leaves the stream running", async ({ page, app }) => {
  await page.click("#slow");
  await expect(page).toHaveTitle("patched");
  await page.click("#fragment");
  app.release("end");
  await ended(page, "/r/slow");
  await expect(page).toHaveURL(app.url + "/r/slow#top");
});

test("cross-route fragment sets target and focus", async ({ page }) => {
  await page.click("#section");
  await ended(page, "/r/long");
  await expect(page.locator(":target")).toHaveAttribute("id", "target");
  await expect(page.locator("#target")).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(2000);
});

test("back and forward replay responses and restore scroll", async ({
  page,
  app,
}) => {
  await page.click("#long");
  await ended(page, "/r/long");
  await page.evaluate(() => scrollTo(0, 1500));
  await page.waitForFunction(() => scrollY === 1500);
  await page.evaluate(() =>
    (document.getElementById("b") as HTMLElement).click(),
  );
  await ended(page, "/r/b");
  const before = app.requests.length;
  await page.evaluate(() => history.back());
  await expect(page.locator("#first")).toHaveText("long");
  await page.waitForFunction(() => scrollY === 1500);
  await page.evaluate(() => history.forward());
  await expect(page.locator("#first")).toHaveText("b");
  expect(app.requests).toHaveLength(before);
});

test("beforeunload guard does not prompt for patched links or forms", async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.evaluate(() =>
    addEventListener("beforeunload", (event) => {
      event.preventDefault();
      event.returnValue = "";
    }),
  );
  await page.click("#b");
  await ended(page, "/r/b");
  await page.click("#postb");
  await ended(page, "/r/post");
  expect(dialogs).toEqual([]);
});

test("form POST to the shown URL adds its own entry", async ({ page }) => {
  await page.click("#postb");
  await ended(page, "/r/post");
  const before = await page.evaluate(() => history.length);
  await page.click("#postb");
  await page.waitForFunction(
    () => window.events.filter((event) => event.type === "end").length === 2,
  );
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test("a traversal's patch shows loading until its response ends", async ({
  page,
  app,
}, info) => {
  test.skip(
    !!info.project.metadata.base,
    "Base router has no browser transition",
  );
  await page.click("#slow");
  await expect(page).toHaveTitle("patched");
  // Leaving before the response ends keeps nothing to replay.
  await page.click("#b");
  await ended(page, "/r/b");
  await page.evaluate(() => history.back());
  await page.waitForFunction(
    () => window.events.filter((e) => e.type === "commit").length === 3,
  );
  expect(await page.evaluate(() => !!window.navigation.transition)).toBe(true);
  app.release("end");
  await ended(page, "/r/slow");
  await page.waitForFunction(() => !window.navigation.transition);
});

// A stopped traversal never leaves the entry shown: one stopped before its page
// arrives goes back, loading nothing, whether its request or its first frame waits.
for (const when of ["request", "first frame"]) {
  for (const order of orders) {
    test(`stopping a traversal while its ${when} waits goes back: ${order}`, async ({
      page,
      app,
    }, info) => {
      test.skip(!!info.project.metadata.base, "No browser navigation to stop");
      const pending = when === "request";
      const start = pending ? "/r/late" : "/r/a";
      if (pending) {
        await page.goto(app.url + start);
        await page.waitForFunction(() =>
          window.events?.some((event) => event.type === "ready"),
        );
      }
      // Documents loaded from here on: none, or a reload of the start page.
      const loaded = app.requests.length;
      await listen(page, order, seen);
      await page.click("#b");
      await ended(page, "/r/b");
      if (!pending) await page.evaluate(() => (window.pauseFrame = true));
      await page.evaluate(() => history.back());
      await page.waitForFunction(
        (pending) =>
          window.events.some((e) =>
            pending
              ? e.type === "request" && e.url === "/r/late"
              : e.type === "held",
          ),
        pending,
      );
      if (pending) await page.evaluate(() => window.stop());
      else {
        // The router's stop runs in a task the stop queues; the frame goes after it.
        await page.evaluate(async () => {
          window.stop();
          await new Promise((resolve) => setTimeout(resolve));
          window.releaseFrame!();
        });
      }
      // Firefox's stop only cancels a pending request, which fails as a network
      // error would, so the entry reloads; once the response came, it does nothing.
      const firefox = info.project.name === "firefox";
      const shown = !firefox ? "/r/b" : pending ? start : "/r/a";
      await expect
        .poll(() =>
          page
            .evaluate(
              () =>
                window.events.some((event) => event.type === "ready") &&
                location.pathname +
                  " " +
                  (document.getElementById("first") ??
                    document.getElementById("top"))!.textContent,
            )
            .catch(() => false),
        )
        .toBe(shown + " " + shown.slice(3));
      expect(
        app.requests
          .slice(loaded)
          .filter((r) => !r.patch && r.path.startsWith("/r/"))
          .map((r) => r.path),
      ).toEqual(firefox && pending ? [start] : []);
      await control(page);
    });
  }
}

async function ended(page: Page, path: string) {
  await expect(page).toHaveTitle("patched");
  await page.waitForFunction(
    (path) =>
      window.events.some(
        (event) => event.type === "end" && event.url.startsWith(path),
      ),
    path,
  );
}
