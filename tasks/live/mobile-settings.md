# Mobile settings

Status: draft
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

## Scope

In: to be shaped.

Out: to be shaped.

## Open questions

- [ ] 1. Which interface settings does mobile get: language, color scheme, light and dark themes, motion, date and
  time formats? — open
- [ ] 2. Which learning settings does mobile edit: daily limits, day boundary, learn-ahead, and the default
  algorithm and template? — open
- [ ] 3. Does Settings replace the Sync tab, or sit beside it as a third tab? — open
- [ ] 4. Does this task add leaving a space on mobile, with Add or Replace when joining with data? — open

## Plan

## Outcome
