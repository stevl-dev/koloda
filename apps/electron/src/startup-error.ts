// WHY: main has no Lingui catalog, and the language the user picked lives in the renderer, which never started.
// INTERFACE-SETTINGS.md (§Language) falls back to the device language, which main has; these are the two offered
// languages.
const COPY = {
  en: { title: "Couldn't start the app", database: "Database" },
  ru: { title: "Не удалось запустить приложение", database: "База данных" },
};

export function describeStartupError(
  error: unknown,
  locale: string,
  dbPath: string,
): { title: string; content: string } {
  const copy = locale.toLowerCase().startsWith("ru") ? COPY.ru : COPY.en;
  return { title: copy.title, content: `${startupErrorReason(error)}\n\n${copy.database}: ${dbPath}` };
}

function startupErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // WHY: the addon throws an AppError as a JSON `{ code, details }` message (`to_napi_error` in src-rust/src/lib.rs).
  try {
    const parsed = JSON.parse(message) as { code?: unknown; details?: unknown } | null;
    if (typeof parsed?.code === "string") {
      return typeof parsed.details === "string" ? `${parsed.code}: ${parsed.details}` : parsed.code;
    }
  } catch {}
  return message;
}
