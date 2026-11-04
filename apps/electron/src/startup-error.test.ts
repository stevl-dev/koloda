import { describe, expect, it } from "vitest";
import { describeStartupError } from "./startup-error";

const DB_PATH = "/data/koloda/koloda.db";

describe("describeStartupError", () => {
  it.each([
    {
      name: "an addon envelope with details",
      error: new Error('{"code":"db_migration","details":"applied migration 99 is unknown"}'),
      reason: "db_migration: applied migration 99 is unknown",
    },
    {
      name: "an addon envelope without details",
      error: new Error('{"code":"unknown","details":null}'),
      reason: "unknown",
    },
    {
      name: "a plain error",
      error: new Error("Cannot find module 'koloda_electron.node'"),
      reason: "Cannot find module 'koloda_electron.node'",
    },
    {
      name: "a thrown string",
      error: "disk full",
      reason: "disk full",
    },
    {
      name: "JSON without a code",
      error: new Error('{"message":"not an envelope"}'),
      reason: '{"message":"not an envelope"}',
    },
  ])("shows $name as its reason, then the database path", ({ error, reason }) => {
    expect(describeStartupError(error, "en-US", DB_PATH).content).toBe(`${reason}\n\nDatabase: ${DB_PATH}`);
  });

  it.each([
    { locale: "ru-RU", title: "Не удалось запустить приложение", database: "База данных" },
    { locale: "ru", title: "Не удалось запустить приложение", database: "База данных" },
    { locale: "RU", title: "Не удалось запустить приложение", database: "База данных" },
    { locale: "en-US", title: "Couldn't start the app", database: "Database" },
    { locale: "de", title: "Couldn't start the app", database: "Database" },
  ])("picks the copy for the $locale device locale", ({ locale, title, database }) => {
    expect(describeStartupError(new Error("boom"), locale, DB_PATH)).toEqual({
      title,
      content: `boom\n\n${database}: ${DB_PATH}`,
    });
  });
});
