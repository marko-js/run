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
