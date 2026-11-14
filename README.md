# ui-testing

A Claude Code skill for testing a web UI thoroughly and proving the coverage.

"Write some UI tests" usually produces a handful of happy-path clicks that pass while
the details users actually notice stay broken: the wrong sidebar item highlighted, an
empty state nobody rendered, a button whose text fails contrast in light mode only.
This skill splits UI testing into seven layers, drives every one of them from fixed
data, and finishes with a coverage report that *lists* what's untested instead of
leaving you to guess.

## The seven layers

| # | Layer | Catches |
|---|---|---|
| 1 | **Deterministic fixtures**: pinned date, a captured API snapshot, network mocks per state | makes every other layer repeatable and free to run |
| 2 | **Behavior tests**: one Playwright test per interaction, asserting what a user would notice | broken buttons, toggles, shortcuts, navigation |
| 3 | **State matrix**: empty / loading / error / populated / edge per region; hover / pressed / focus / disabled / busy per control | states nobody built or nobody tested |
| 4 | **Visual regression**: screenshot baselines per theme × viewport | the "border came out lavender" class of bug |
| 5 | **Accessibility + keyboard**: axe WCAG AA scans plus a Tab walk checking every focus ring | contrast, labels, unreachable controls |
| 6 | **Measured coverage**: V8 JS coverage merged across the suite | functions and branches no test ever ran |
| 7 | **Strict console**: any JS error fails the test | silent runtime errors |

Plus a **triage rule**: before changing anything, decide whether the app or the test is
wrong. "Fixing" a test to match a real bug is how bugs get hidden.

## Install

Symlink the skill directory into your skills folder:

```bash
git clone https://github.com/viviannnl/ui-testing.git
ln -s "$PWD/ui-testing/ui-testing" ~/.claude/skills/ui-testing
```

Or for a single project:

```bash
ln -s /path/to/ui-testing/ui-testing .claude/skills/ui-testing
```

Verify with `/help`: `ui-testing` should appear in the skill list. It also fires
automatically when you ask for UI, E2E, browser, visual-regression or accessibility tests.

## Using the scaffold without the skill

```bash
ui-testing/scripts/scaffold.sh /path/to/your/project
```

Creates `e2e/` with a Playwright config (desktop + mobile projects, Chrome channel,
screenshot tolerance), shared fixtures (strict console, coverage capture, `mockApi`,
`mockJob`, an `open()` that waits for entrance animations), the coverage report and a
state-matrix template, then installs `@playwright/test` and `@axe-core/playwright`.
Needs Node 20+ and Google Chrome. It never overwrites existing files.

```bash
cd e2e
npx playwright test --update-snapshots   # first run: create baselines
npx playwright test                      # every run after
node coverage-report.mjs --min=95        # % covered + everything untouched; fails below 95%
```

## Does it actually work?

It was extracted from a real suite: 99 browser tests for a local dashboard, desktop
and mobile, built with exactly this method. On the first full run that suite found
**two real app bugs** that manual clicking had missed, and the coverage report found
a third path that had never run:

- white text on the light-theme primary button failed WCAG AA (axe, light theme only)
- after a sidebar jump, PageDown never handed the highlight back to scrolling (found
  because the coverage report showed the release branch never executed)

It also produced three *test* bugs (counting hidden `<details>` content as tabbable,
scrolling mid-animation, scanning contrast while panels were still fading in). Those
went into the skill as triage examples, so the next suite skips them.
The suite ended at 100% of functions and 99.3% of code executed, three runs green in a row.

**Caveats:** n=1 app, and I wrote both the app and the skill. The templates are
smoke-tested on a second, minimal app, not on a large codebase. Visual baselines are
per-OS: generate them in the same environment that compares them.

## Scope

Covers browser-level testing of web UIs with Playwright. Building or styling the UI is
the `vibe-ui` skill's job; its state matrix and ship gate are what this skill verifies.
Backend unit tests stay in the project's own runner.

## Layout

```
ui-testing/
├── README.md
└── ui-testing/                    ← symlink this into ~/.claude/skills/
    ├── SKILL.md                   ← the method, workflow checklist, rules, ship gate
    ├── references/
    │   ├── layer-patterns.md      ← copy-ready test code for every layer
    │   └── triage-examples.md     ← real failures: app bug vs test bug vs intent
    ├── scripts/
    │   ├── scaffold.sh            ← create e2e/ in a project
    │   └── coverage-report.mjs    ← merge coverage, list untouched code
    └── assets/
        ├── playwright.config.ts
        ├── fixtures.ts
        └── state-matrix.md
```

## License

MIT
