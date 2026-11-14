# Layer patterns

Copy-ready Playwright patterns for each layer. All examples assume the helpers in
`assets/fixtures.ts` (`test`, `expect`, `open`, `mockApi`, `mockJob`,
`allowConsoleErrors`, `expectNoHorizontalOverflow`).

## Contents
- [States: populated, empty, loading, error, edge](#states)
- [Interactions: effect, request, busy, failure, validation](#interactions)
- [Navigation and highlight](#navigation)
- [Theme](#theme)
- [Accessibility and keyboard](#accessibility-and-keyboard)
- [Interaction states via computed style](#interaction-states)
- [Visual regression](#visual-regression)
- [Real round-trips](#real-round-trips)

## States

```ts
test("empty: no items -> first-run prompt with an action", async ({ page, mockApi }) => {
  await mockApi("/api/dashboard", (d) => { d.items = []; });
  await open(page);
  await expect(page.locator("#items")).toContainText("Nothing here yet");
  await expect(page.getByRole("button", { name: "Add your first" })).toBeEnabled();
});

test("loading: slow response shows a skeleton shaped like the layout", async ({ page, mockApi }) => {
  await mockApi("/api/dashboard", undefined, { delayMs: 1500 });
  await page.goto("/");
  await expect(page.locator(".skeleton").first()).toBeVisible();
  await expect(page.locator("#items")).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".skeleton")).toHaveCount(0);
});

test("error: failure explains itself and retry recovers", async ({ page, mockApi }, info) => {
  allowConsoleErrors(info);                     // the browser logs the 500
  await mockApi("/api/dashboard", undefined, { status: 500 });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Couldn't load");
  await page.unroute("**/api/dashboard");
  await mockApi("/api/dashboard");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#items")).toBeVisible();
});

test("edge: long text truncates, page never scrolls sideways", async ({ page, mockApi }) => {
  const LONG = "x".repeat(40) + " a very long realistic title ".repeat(4);
  await mockApi("/api/dashboard", (d) => { d.items[0].title = LONG; });
  await open(page);
  await expectNoHorizontalOverflow(page);
  const t = page.locator("#items .title").first();
  await expect(t).toHaveAttribute("title", LONG);                    // full text still reachable
  expect(await t.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true); // visibly truncated
});

test("edge: hostile text renders as text", async ({ page, mockApi }) => {
  const evil = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>`;
  await mockApi("/api/dashboard", (d) => { d.items[0].title = evil; d.items[0].url = "javascript:window.__xss=3"; });
  await open(page);
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
});
```

Also cover: huge numbers, one item vs. many (e.g. 40), every optional field missing, and a fast load that must **not** flash the skeleton.

## Interactions

Each control gets: its effect, the request it sends, its busy state, its failure, and validation that blocks a request.

```ts
test("plan: request body, busy lock, then result", async ({ page, mockApi, mockJob }) => {
  await mockApi("/api/dashboard");
  const job = await mockJob("/api/plan", { steps: ["Planning…"], holdMs: 400 });
  await open(page);
  await page.getByRole("button", { name: "Plan" }).click();
  const busy = page.locator('button[aria-busy="true"]');
  await expect(busy).toBeDisabled();
  await expect(page.getByRole("button", { name: "Refresh" })).toBeDisabled(); // other jobs locked
  await expect(busy).toHaveCount(0, { timeout: 5000 });
  expect(job.bodies[0]).toEqual({ minutes: 60 });
});

test("job failure: error toast and controls unlock", async ({ page, mockApi, mockJob }) => {
  await mockApi("/api/dashboard");
  await mockJob("/api/plan", { error: "Rate limited" });
  await open(page);
  await page.getByRole("button", { name: "Plan" }).click();
  await expect(page.getByRole("status")).toContainText("Rate limited");
  await expect(page.getByRole("button", { name: "Plan" })).toBeEnabled();
});

test("validation blocks the request", async ({ page, mockApi, mockJob }) => {
  await mockApi("/api/dashboard");
  const job = await mockJob("/api/feedback");
  await open(page);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.locator("#feedback")).toBeFocused();
  expect(job.bodies).toHaveLength(0);
});
```

Also cover: keyboard shortcuts (`press("Meta+Enter")`), input that survives re-renders during progress updates, multi-step chains in order (`expect.poll(() => postedPaths).toEqual([...])`), every external link has `rel=noopener` and an `http(s)` href.

## Navigation

```ts
const current = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[data-nav][aria-current="true"]')].map((a: any) => a.dataset.nav));

for (const id of SECTIONS) {
  test(`clicking ${id} highlights exactly ${id}`, async ({ page }) => {
    await open(page);
    await page.locator(`[data-nav="${id}"]`).click();
    expect(await current(page)).toEqual([id]);
    await expect(page.locator(`#${id}`)).toBeInViewport();
  });
}

test("manual scroll takes over from a click", async ({ page }) => {
  await open(page);
  await page.locator('[data-nav="readiness"]').click();
  await page.waitForTimeout(900);          // human pause: let the smooth scroll finish
  await page.mouse.move(600, 500);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => current(page)).toEqual(["plan"]);
});
```

Also cover: wheel, keyboard (PageDown/arrows) and touch hand-off, reaching the page bottom, highlight surviving a re-render, sections that share a vertical position in multi-column layouts.

## Theme

```ts
test("default theme on both OS settings", async ({ browser }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({ colorScheme });
    const page = await ctx.newPage();
    await page.goto("/"); await page.locator("#app > *").first().waitFor();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    await ctx.close();
  }
});
```

Also cover: toggle → persists after reload → relabels itself; a stale preference key from an older build is ignored; the OS colour scheme doesn't leak tokens into the chosen theme (compare `getComputedStyle(document.body).backgroundColor`).

## Accessibility and keyboard

```ts
import AxeBuilder from "@axe-core/playwright";
const scan = async (page) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0].target}`)).toEqual([]);
};
```

Scan each screen, each theme, and once with everything expanded (hidden content isn't scanned until shown).

Tab walk — every visible control reachable, each with a visible indicator:

```ts
const expected = await page.locator("a[href], button:not([disabled]), input, textarea, select, summary")
  .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null
    && !(e.parentElement?.closest("details:not([open])") && e.tagName !== "SUMMARY")).length);
const seen = new Set(); const noRing = [];
for (let i = 0; i < expected + 5; i++) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement; if (!el || el === document.body) return null;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return { key: `${el.tagName}|${el.textContent?.trim().slice(0, 30)}|${Math.round(r.top + scrollY)}:${Math.round(r.left)}`,
             ring: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none" };
  });
  if (info) { seen.add(info.key); if (!info.ring) noRing.push(info.key); }
}
expect(noRing).toEqual([]);
expect(seen.size).toBeGreaterThanOrEqual(expected);
```

Also cover: Enter/Space on custom toggles, Escape closes overlays/edit modes, focus moves to the right field after validation errors.

## Interaction states

```ts
const bg = (l) => l.evaluate((e) => getComputedStyle(e).backgroundColor);
const rest = await bg(button);
await button.hover();
await expect.poll(() => bg(button)).not.toBe(rest);                       // hover differs
await page.mouse.down();
expect(await button.evaluate((e) => getComputedStyle(e).transform)).not.toBe("none"); // pressed
await page.mouse.up();
```

Assert disabled (`cursor: not-allowed`, reduced opacity) and busy (`aria-busy`, spinner, `cursor: progress`) separately. Reduced motion: `browser.newContext({ reducedMotion: "reduce" })` then assert transition durations ≈ 0 and `scroll-behavior: auto`.

## Visual regression

```ts
for (const theme of ["dark", "light"]) {
  test(`page — ${theme} @responsive`, async ({ page, mockApi }) => {
    await mockApi("/api/dashboard");
    await page.addInitScript((t) => localStorage.setItem("app-theme", t), theme);
    await open(page);
    await page.mouse.move(0, 0);                 // no accidental hover
    await expect(page).toHaveScreenshot(`page-${theme}.png`, { fullPage: true });
  });
}
```

Add element-level shots (`expect(locator).toHaveScreenshot()`) for key panels in interesting states (expanded, selected). Panel shots give smaller, readable diffs.

## Real round-trips

```ts
test.describe.configure({ mode: "serial" });
test("record a session and see it in history", async ({ page }) => { /* real backend, relative asserts */ });
test("API rejects cross-site requests", async ({ request }) => {
  expect((await request.post("/api/plan", { form: { minutes: "30" } })).status()).toBe(415);
  expect((await request.get("/api/dashboard", { headers: { Host: "evil.example" } })).status()).toBe(403);
});
```

Keep these few. They prove the mocks match reality and the server's guards hold.
