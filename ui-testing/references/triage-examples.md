# Triage examples

Real failures from a first full run of this suite on a dashboard, sorted by which side was wrong. Use them to recognise the pattern quickly.

## App bugs (fix the app, keep the test)

| Symptom | Found by | Cause | Fix |
|---|---|---|---|
| axe `color-contrast` on the primary button, light theme only | axe scan per theme | White text on a teal accent measured below 4.5:1; teal needs a darker shade than blue at the same lightness | Light theme uses one shade darker for primary fills; probe measured 5.65:1 |
| Clicking "Readiness" in the sidebar highlighted "Today" | user report → navigation spec | Scroll-tracking picked the topmost panel; in a two-column layout two panels share the top | A click selects outright; manual scroll releases it |
| PageDown after a sidebar jump never moved the highlight | coverage report (release branch never ran) | Release only listened when focus was on `<body>`, but the jump focuses the panel heading | Release on scroll keys unless focus is in a text field |
| Theme appeared light although dark is the default | user report → theme spec | An older build stored the theme under the same key | New storage key; test pre-seeds the stale key |
| Dark theme partly overridden on dark-mode OS | theme spec comparing computed background | A `prefers-color-scheme` rule had higher selector specificity than the theme layer | Raise the theme selector to the same specificity, later in the cascade |
| Focal border rendered lavender instead of teal | visual review of a screenshot | `color-mix(in oklch, accent, transparent-white)` interpolated hue | Mix in sRGB |

## Test bugs (fix the expectation, comment why)

| Symptom | Real cause | Fix |
|---|---|---|
| Tab walk "expected ≥ 150, saw 74" | Links inside a closed `<details>` have `offsetParent` in Chrome but are not tabbable | Exclude closed-`details` content (except `summary`) from the expected count |
| Wheel scroll after a click didn't change the highlight | Wheel fired during the click's smooth scroll; the browser finished the programmatic scroll | Wait for the smooth scroll to settle, as a person would |
| axe contrast failure only sometimes | Scan ran while panels were still fading in (opacity < 1 lowers real contrast) | `open()` waits for the first-paint animation class to clear |

## Intentional design (assert the intent)

| Symptom | Intent | Fix |
|---|---|---|
| Busy button cursor was `progress`, test expected `not-allowed` | Busy ≠ disabled: busy shows progress, disabled shows not-allowed | Assert both states separately |

## Probe pattern

When the cause isn't obvious, write a throwaway spec that prints measurements, run it, delete it:

```ts
test("probe", async ({ page, mockApi }) => {
  await mockApi("/api/dashboard"); await open(page);
  await page.locator('[data-nav="readiness"]').click();
  for (const t of [100, 400, 900]) {
    await page.waitForTimeout(t);
    console.log(t, await page.evaluate(() => [scrollY, document.querySelector('[aria-current]')?.textContent]));
  }
});
```
