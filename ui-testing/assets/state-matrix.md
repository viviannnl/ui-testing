# UI state matrix

Fill one row per data region and per control. Each cell names the test that covers it
(`spec › test name`), `n/a` with a reason, or stays empty — an empty cell is a gap.

## Regions

| Region | Populated | Empty | Loading | Error | Edge (long text / huge numbers / hostile HTML / missing fields / 1 vs many) |
|---|---|---|---|---|---|
| _e.g. Today panel_ | states › renders every panel | states › no plan → time picker | states › slow load skeleton | states › dashboard failure + retry | states › long titles truncate; hostile text |
| | | | | | |

## Controls

| Control | Effect + request | Hover | Pressed | Focus-visible | Disabled | Busy | Failure |
|---|---|---|---|---|---|---|---|
| _e.g. Record session_ | interactions › recap via ⌘↵ | theme-a11y › primary button states | theme-a11y › primary button states | theme-a11y › Tab walk | theme-a11y › primary button states | interactions › planning locks buttons | gaps › job failure toast |
| | | | | | | | |

## Cross-cutting

| Concern | Test |
|---|---|
| Default theme (both OS settings) | |
| Theme toggle persists | |
| axe: each theme, each screen, expanded | |
| Keyboard: every control reachable, visible focus | |
| Reduced motion | |
| Small screen: no sideways scroll | |
| Visual baselines: theme × viewport | |
| Strict console | (fixture) |
| Coverage report reviewed | |
