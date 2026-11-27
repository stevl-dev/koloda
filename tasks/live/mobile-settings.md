# Mobile settings

Status: ready
Guides: agents/IMPLEMENTATION-PLAN.md, agents/TASKS.md, apps/mobile/README.md, docs/decisions/MOBILE-HOST.md, docs/specs/INTERFACE-SETTINGS.md, docs/specs/LEARNING-SETTINGS.md, docs/specs/SYNC.md, docs/decisions/STORAGE-BUCKETS.md, docs/decisions/CACHE-REFRESH.md, agents/ADD-COLOR-THEME.md, agents/FUNCTIONAL-SPECIFICATIONS.md, agents/MARKDOWN.md, agents/CODE-STYLE.md, agents/CODE-DOCUMENTATION.md, agents/TESTING.md, agents/VERIFY.md, agents/I18N.md, agents/DEPENDENCIES.md
Flow: local

## Intent

Give the mobile app a Settings tab, so the phone can change what the desktop's settings screens change.
Today the mobile app has no settings:
`docs/specs/INTERFACE-SETTINGS.md` (§Color Scheme) says it follows the device's scheme and shows English,
and its only other tab besides Lessons is Sync, which `docs/specs/SYNC.md` (§Platform Availability) describes.

Done when the app does the following; the device checks that confirm it run later, outside this task:

- a Settings tab takes the Sync tab's place and opens Interface, Learning, and Sync screens;
- the user can choose the language, the color scheme, the light and dark themes, motion, and the date and time
  formats, and each takes effect at once;
- the user can edit the daily limits, the day boundary, and the learn-ahead limit;
- the Sync screen does what the Sync tab does today;
- the specs state what mobile settings leave out.

What the code holds at `7bae057c`:

- The façade (`apps/mobile/src-rust/src/lib.rs`) reads a settings row (`get_settings`) but has no write;
  the desktop addon has `set_settings` and `patch_settings` over `koloda::repo::settings`.
- `apps/mobile/src/colors.ts` holds one light and one dark palette, the GitHub ones, picked by the system scheme.
- `apps/mobile/src/i18n.ts` activates English, and `apps/mobile/lingui.config.ts` lists `en` only.
  `src/components/learned-today.tsx` and `src/lesson/lesson-card.tsx` pass `"en"` to their formatters.
- First setup (`src/host/setup.ts`) and joining (`src/components/join-space.tsx`) both seed `seedSettings({})`,
  so the interface row starts at the defaults.
- The Sync tab's last-sync time comes from `useSyncStatusLines` (`@koloda/settings-react`), which already reads
  `dateFormatAtom` and `timeFormatAtom`.
- `INTERFACE_SETTING_ATOMS` (`libs/settings-react/src/lib/interface-controls/interface-setting-atoms.ts`) maps each
  interface field to its atom; `motionSettingAtom` comes from `@koloda/ui`.

## Scope

In:

- A Settings tab in place of the Sync tab, with Interface, Learning, and Sync screens.
- Interface: language with a Russian catalog for the mobile app, color scheme, light and dark themes
  (Atom One beside GitHub), motion, and date and time formats.
- Learning: daily limits, counts toward total, Day starts at, and the learn-ahead limit.
- Settings writes through the façade.
- Updating `docs/specs/INTERFACE-SETTINGS.md`, `docs/specs/LEARNING-SETTINGS.md`, `docs/specs/SYNC.md`, and
  `apps/mobile/README.md` (§Device checks) with each change.
- At Archive, widen the `tasks/DEFERRED.md` handoff "build the mobile app at the tip and run the device checks" to the
  checks this task added or changed.

Out:

- The default algorithm and template: mobile cannot create decks, where they apply.
  The learning form keeps them as they are.
- Leaving a space, and Add or Replace when joining with data; the Sync screen does what the Sync tab does today.
- Hotkeys, AI, and assistant settings; the phone has neither shortcuts nor the assistant.
- Desktop zoom.
- iOS.
- Running the device checks.
  Each item adds or changes its checks in `apps/mobile/README.md` (§Device checks), and none of them runs.

## Open questions

- [x] 1. Which interface settings does mobile get: language, color scheme, light and dark themes, motion, date and
  time formats? — All of them, with a Russian catalog for the mobile app's own strings.
- [x] 2. Which learning settings does mobile edit: daily limits, day boundary, learn-ahead, and the default
  algorithm and template? — Daily limits, the day boundary, and learn-ahead; not the defaults.
- [x] 3. Does Settings replace the Sync tab, or sit beside it as a third tab? — It replaces it:
  two tabs, Lessons and Settings, and the Sync panel moves to a Sync screen under Settings.
- [x] 4. Does this task add leaving a space on mobile, with Add or Replace when joining with data? — No.
- [x] 5. Does any device check run in this task? — No, as in `mobile-lesson-parity` (question 4):
  the human runs them all once the planned mobile features have shipped.

## Plan

- [x] 1. Move the Sync tab under a Settings tab
  Goal: the tabs are Lessons and Settings.
  The Settings tab is a stack: its first screen lists Sync, which opens its own screen.
  Items 2 and 6 add the Interface and Learning rows with their screens, so no row opens an empty screen.
  The Sync screen shows `SyncPanel` as the Sync tab does now, with the same keyboard handling.
  Read the installed Expo Router for how a stack nests inside a native tab before relying on it;
  the header's back control returns to the list.
  Update `docs/specs/SYNC.md` (§Platform Availability): Settings → Sync on mobile, as on desktop, in place of a Sync tab.
  Update `apps/mobile/README.md` (§Device checks): the tabs check names Lessons and Settings, and the Sync checks open
  Settings → Sync.
  Constraints: `apps/mobile/src/app`, `apps/mobile/src/components`, the locale catalog.
  Done when: a mobile Jest test opens Settings → Sync and sees the join form; `nx run @koloda/mobile:typecheck`;
  `bun run check:push`.
  Commit: Move the mobile Sync tab under a Settings tab
  Depends on: none

- [ ] 2. Choose the color scheme on mobile
  Goal: the Interface screen offers Light, Dark, and System, by `docs/specs/INTERFACE-SETTINGS.md` (§Color Scheme),
  and the whole app follows it: every screen, the tab bar, the headers, and the status and navigation bars.
  System keeps following the device live.
  Add `patch_settings` and `set_settings` to `koloda-mobile` over `koloda::repo::settings`, as the desktop addon
  exposes them, each through the façade's write path so sync learns of the change; Rust tests for both;
  regenerate the bindings.
  Add `patchSettingsMutation` and `setSettingsMutation` to `MobileQueries`, refreshing the keys
  `docs/decisions/CACHE-REFRESH.md` names for settings.
  Each change saves its own field at once with no save button, and a failed write shows the previous value again
  with the error, by §Editing and Saving.
  Boot reads the interface row and sets the interface atoms (`INTERFACE_SETTING_ATOMS`) before the first screen shows,
  so the app opens in the saved scheme with no flash (§Startup).
  `useAppColors` and `useNavigationTheme` read the scheme atom; keep the invariant that no screen hard-codes a color.
  Joining a space seeds this device's current interface settings instead of the defaults,
  since `settings.interface` is device-local (`docs/decisions/STORAGE-BUCKETS.md`).
  Update `docs/specs/INTERFACE-SETTINGS.md`: replace "The mobile app has no interface settings yet" with what mobile
  has so far, and add a Mobile App section that items 3 to 5 extend.
  Update `apps/mobile/README.md` (§Device checks) with a scheme check: Dark with the system light, Light with it dark,
  and System following a live switch.
  Constraints: `apps/mobile/src-rust`, `apps/mobile/native`, `apps/mobile/src`, the locale catalog.
  Read the installed React Native and `expo-system-ui` for how an app overrides the system scheme
  (`Appearance.setColorScheme` or the like) before relying on it.
  Done when: a mobile Jest test picks Dark and sees the façade's patch and the dark colors, and a failed write shows the
  previous choice and the error; `nx run @koloda/mobile:test-rust`; `bun run check:push`.
  Commit: Choose the color scheme on mobile
  Depends on: 1

- [ ] 3. Choose light and dark themes on mobile
  Goal: the Interface screen offers a light theme and a dark theme, from `LIGHT_THEMES` and `DARK_THEMES`
  (`@koloda/app`), by §Color Themes; only the active side's theme applies, and switching the scheme keeps both choices.
  Add Atom One Light and Atom One Dark palettes to `apps/mobile/src/colors.ts` beside the GitHub ones, keyed by the
  theme ids, with values taken from `libs/ui/src/lib/styles/themes/atom-one-light.css` and `atom-one-dark.css`;
  every `AppColors` field must read well on each palette.
  Startup uses the saved themes, as item 2 does for the scheme.
  Update `agents/ADD-COLOR-THEME.md`: a new theme also adds a mobile palette.
  Update `docs/specs/INTERFACE-SETTINGS.md` (§Mobile App) and `apps/mobile/README.md` (§Device checks).
  Constraints: `apps/mobile/src`, the locale catalog, `agents/ADD-COLOR-THEME.md`.
  Done when: a mobile Jest test picks Atom One Dark under Dark and sees its colors, and a test checks every theme id
  in `LIGHT_THEMES` and `DARK_THEMES` has a mobile palette; `bun run check:push`.
  Commit: Choose light and dark themes on mobile
  Depends on: 2

- [ ] 4. Switch the mobile app's language
  Goal: the Interface screen offers English and Russian, by §Language, and switching changes all text at once,
  including the tab labels and the headers.
  Add `ru` to `apps/mobile/lingui.config.ts` and translate the mobile app's own messages in its Russian catalog;
  the lib catalogs already hold Russian.
  Activate the saved language at boot, and set `langAtom` with it.
  Replace the hard-coded `"en"` in `src/components/learned-today.tsx` and `src/lesson/lesson-card.tsx` with the active
  locale.
  At first setup, seed the language from the device language when it is offered, otherwise English, and seed the
  starter content in that language (§First Setup).
  Read how the installed Hermes and Expo expose the device locale; adding `expo-localization` follows
  `agents/DEPENDENCIES.md`.
  Update `agents/I18N.md`: the mobile app has English and Russian.
  Update `docs/specs/INTERFACE-SETTINGS.md` (§Mobile App): drop "it shows English", and say how mobile picks the
  language at startup.
  Update `apps/mobile/README.md` (§Device checks) with a language check.
  Constraints: `apps/mobile`, the mobile locale catalogs, `agents/I18N.md`.
  Done when: a mobile Jest test switches to Russian and sees a Russian tab label and Russian lesson counts,
  and a test seeds a fresh install from a Russian device locale; `bun run check:i18n`; `bun run check:push`.
  Commit: Switch the mobile app's language
  Depends on: 2

- [ ] 5. Choose motion and timestamp formats on mobile
  Goal: the Interface screen offers motion (On, Off, System) by §Motion, and the date and time formats by
  §Date and Time Format: the presets, a custom date pattern with its validation, and a preview under each.
  Off suppresses the card's swipe, spring, and appear animations; System follows the device's reduce-motion setting.
  Brief fades may still play.
  Read the installed Reanimated for its reduce-motion support before relying on it.
  The formats change the Sync screen's last-sync time at once.
  If `motionSettingAtom` cannot be imported from `@koloda/ui` under Hermes without DOM code, move it to a DOM-free home
  both hosts import; do not copy it.
  Update `docs/specs/INTERFACE-SETTINGS.md` (§Mobile App) and `apps/mobile/README.md` (§Device checks).
  Constraints: `apps/mobile/src`, the locale catalog, and a DOM-free home for the motion atom if needed.
  Done when: mobile Jest tests pick Off and see the card render without animation config, pick a date preset and see
  the last-sync time change, and save an invalid custom pattern and see the error with the previous format kept;
  `bun run check:push`.
  Commit: Choose motion and timestamp formats on mobile
  Depends on: 2

- [ ] 6. Edit learning settings on mobile
  Goal: the Learning screen edits the daily limits, Day starts at, and the learn-ahead limit,
  by `docs/specs/LEARNING-SETTINGS.md`.
  Total, New, Learn, and Review each take a number or Unlimited; turning Unlimited off fills in the first-setup
  number; New, Learn, and Review each have a counts-toward-total switch.
  Day starts at is a time of day whose clock follows the time format (§Date and Time Format).
  Learn-ahead takes hours from 0 to 48 and minutes from 0 to 59.
  Validate with `learningSettingsValidation` (`@koloda/app`) and show each error at its field;
  Save writes through `setSettingsMutation` with the default algorithm and template kept as they are,
  and Discard restores the saved values.
  While the screen is open, fields the user has not changed take values synced from other devices (§Editing and Saving).
  After a save, the Lessons tab's counts and today's progress reflect the new limits and day,
  through the refreshes `docs/decisions/CACHE-REFRESH.md` names.
  The keyboard covers neither the field being edited nor Save.
  Update `docs/specs/LEARNING-SETTINGS.md` with a Mobile App section: the defaults are not edited there.
  Update `apps/mobile/README.md` (§Device checks) with a learning-settings check.
  Constraints: `apps/mobile/src`, the locale catalog.
  Done when: mobile Jest tests save a new New limit and see the façade's write with the defaults unchanged,
  see a counted limit above Total rejected with the previous settings kept, turn Unlimited off and see the
  first-setup number, and discard; `bun run check:push`.
  Commit: Edit learning settings on mobile
  Depends on: 2

## Outcome
