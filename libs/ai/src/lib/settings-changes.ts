import { z } from "zod";

/**
 * The settings `change_settings` may change, and how a list of changes lands in the settings rows.
 * The tool's executor and the chat's Undo apply changes with the same function.
 * Rules: `docs/specs/ASSISTANT-SETTINGS-CHANGES.md`.
 */

const dailyLimitCap = z.int().min(0).nullable();

// INVARIANT: these lists repeat `LOCALES`, `SCHEMES`, `LIGHT_THEMES`, `DARK_THEMES`, and `MOTION_SETTINGS` in
// `@koloda/app` settings-interface.ts, which the root barrel cannot import (libs/ai README). A test pins them.
export const INTERFACE_LANGUAGES = ["en", "ru"] as const;
export const INTERFACE_SCHEMES = ["light", "dark", "system"] as const;
export const INTERFACE_LIGHT_THEMES = ["atom-one-light", "github-light"] as const;
export const INTERFACE_DARK_THEMES = ["atom-one-dark", "github-dark"] as const;
export const INTERFACE_MOTION = ["on", "off", "system"] as const;

// WHY: each value is checked only for its shape here. The whole row goes through the host's own settings save,
// which applies every rule the settings screen applies, such as a counted limit not above Total.
export const SETTINGS_CHANGE_FIELDS = {
  "learning.dailyLimits.total": dailyLimitCap,
  "learning.dailyLimits.untouched.value": dailyLimitCap,
  "learning.dailyLimits.untouched.counts": z.boolean(),
  "learning.dailyLimits.learn.value": dailyLimitCap,
  "learning.dailyLimits.learn.counts": z.boolean(),
  "learning.dailyLimits.review.value": dailyLimitCap,
  "learning.dailyLimits.review.counts": z.boolean(),
  "learning.dayStartsAt": z.string(),
  "learning.learnAheadLimit": z.tuple([z.int(), z.int()]),
  "learning.defaults.algorithm": z.uuid(),
  "learning.defaults.template": z.uuid(),
  "interface.language": z.enum(INTERFACE_LANGUAGES),
  "interface.scheme": z.enum(INTERFACE_SCHEMES),
  "interface.lightTheme": z.enum(INTERFACE_LIGHT_THEMES),
  "interface.darkTheme": z.enum(INTERFACE_DARK_THEMES),
  "interface.motion": z.enum(INTERFACE_MOTION),
  "interface.dateFormat": z.string(),
  "interface.timeFormat": z.string(),
} as const satisfies Record<string, z.ZodType>;

export type SettingsChangeField = keyof typeof SETTINGS_CHANGE_FIELDS;

export const SETTINGS_CHANGE_FIELD_NAMES = Object.keys(SETTINGS_CHANGE_FIELDS) as [
  SettingsChangeField,
  ...SettingsChangeField[],
];

/** The settings rows a change may touch, in the order a call writes them. */
export const SETTINGS_CHANGE_ROWS = ["learning", "interface"] as const;

export type SettingsChangeRow = (typeof SETTINGS_CHANGE_ROWS)[number];

export type SettingsChange = { field: SettingsChangeField; from: unknown; to: unknown };

export type SettingsRowContents = Partial<Record<SettingsChangeRow, Record<string, unknown>>>;

export function splitSettingsChangeField(field: SettingsChangeField): { row: SettingsChangeRow; path: string[] } {
  const [row, ...path] = field.split(".");
  return { row: row as SettingsChangeRow, path };
}

export function readSettingsValue(rows: SettingsRowContents, field: SettingsChangeField): unknown {
  const { row, path } = splitSettingsChangeField(field);
  let value: unknown = rows[row];
  for (const key of path) value = (value as Record<string, unknown> | undefined)?.[key];
  return value;
}

// INVARIANT: returns new content for each touched row and leaves `rows` as it was; the executor writes `rows`
// back when a later row's save fails.
export function applySettingsValues(
  rows: SettingsRowContents,
  values: Array<{ field: SettingsChangeField; value: unknown }>,
): SettingsRowContents {
  const next: SettingsRowContents = {};
  for (const { field, value } of values) {
    const { row, path } = splitSettingsChangeField(field);
    const content = (next[row] ??= structuredClone(rows[row] ?? {}));
    let parent = content;
    for (const key of path.slice(0, -1)) {
      parent = (parent[key] ??= {}) as Record<string, unknown>;
    }
    parent[path[path.length - 1]] = value;
  }
  return next;
}

export async function saveSettingsRows(
  rows: SettingsRowContents,
  next: SettingsRowContents,
  save: (row: SettingsChangeRow, content: Record<string, unknown>) => Promise<unknown>,
): Promise<void> {
  const saved: SettingsChangeRow[] = [];
  for (const row of SETTINGS_CHANGE_ROWS) {
    const content = next[row];
    if (content === undefined) continue;
    try {
      await save(row, content);
    } catch (error) {
      // INVARIANT: a change saves every row it names or none. Each row is its own save on both hosts,
      // so a failed later row puts the earlier ones back as they were read.
      for (const done of saved) await save(done, rows[done]!);
      throw error;
    }
    saved.push(row);
  }
}

const settingsChangesOutputSchema = z.object({
  changes: z.array(z.object({ field: z.enum(SETTINGS_CHANGE_FIELD_NAMES), from: z.unknown(), to: z.unknown() })),
});

/** The changes a recorded `change_settings` output lists, or null for any other shape. */
export function parseSettingsChanges(output: unknown): SettingsChange[] | null {
  const parsed = settingsChangesOutputSchema.safeParse(output);
  return parsed.success ? (parsed.data.changes as SettingsChange[]) : null;
}
