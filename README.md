# react-native-sortables #605 — reproduction

Minimal repro for [MatiPl01/react-native-sortables#605](https://github.com/MatiPl01/react-native-sortables/issues/605):
two bugs in `autoAdjustOffsetDuringDrag` with collapsible items.

- react-native-sortables **1.9.4** (unpatched — the version under report)
- App shell: Expo SDK 57 / react-native 0.86 so it runs in the CURRENT **Expo Go**
  (the bugs were originally observed on SDK 54 / RN 0.81.5 / reanimated 4.1.x —
  they are pure-JS logic inside the library and reproduce identically on both)

## Run

```bash
npm install
npx expo start
```

Scan the QR with Expo Go (iOS observed; the logic is platform-independent).

One screen: 8 colored cards, each expandable (280px) / collapsible (72px) via
the chevron; a **Collapse all / Expand all** toggle; cards force-collapse
during a drag (common "collapse while sorting" UX). Long-press ~400ms to drag.

## Bug 1 — collapse-all at rest after a drag: stale offset + sorting permanently dead

1. Leave all cards **expanded**.
2. Long-press any card, drag it one slot, drop. (Works.)
3. Tap **Collapse all** — no drag involved.
4. 🐛 The whole list shifts far down by a blank offset, and from now on
   **no long-press activates a drag**.
5. Expand any card → layout snaps back, sorting works again (why this looks
   intermittent in production).

Step 2 matters: without a prior drag, step 3 is harmless.

Root cause (see issue): `AutoOffsetAdjustmentProvider.adaptLayoutProps` runs on
every cross-size change and resolves `activeItemKey ?? prevActiveItemKey`;
`prevActiveItemKey` persists after a drag, so an at-rest size change computes an
offset from the stale key and sets `sortEnabled = false` with no drop event
coming to restore it.

## Bug 2 — drag with no mid-drag size change: ordering never fires

1. Restart the app (fresh mount). Tap **Collapse all** (or collapse each card).
   No drag needed beforehand.
2. Long-press any card and drag it over its neighbours.
3. 🐛 The card lifts and follows the finger, but the vacated slot stays put and
   the other cards never move aside — no reorder fires; the drop reverts.
4. Expand at least one card and drag — sorting works (the drag-start collapse
   of the expanded card IS the mid-drag size change the code path needs).

Root cause (see issue): the grid ordering strategy computes `othersLayout` only
when `additionalCrossOffset !== null`, but the offset only becomes non-null when
a mid-drag size change routes through the offset-application block — a drag
with no size change leaves the strategy returning early on every move.

## Fix we run in production

Both fixes (plus the transition-scoped ordering gate that the second one needs
— removing the null-gate alone regresses size-changing drags) are in the issue
as diffs; we ship them via patch-package. Happy to open a PR.
