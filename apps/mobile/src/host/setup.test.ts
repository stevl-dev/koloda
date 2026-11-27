import { fakeFacade } from "../test/fake-facade";
import { seedDB } from "./setup";

describe("seedDB", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["ru-RU", "ru"],
    ["de-DE", "en"],
  ])("seeds a fresh install on a %s device in %s", async (deviceLocale, language) => {
    jest.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () => ({ locale: deviceLocale }),
    } as Intl.DateTimeFormat);
    const seedDb = jest.fn((_data: string) => Promise.resolve());
    const facade = fakeFacade({ getDbStatus: () => Promise.resolve("blank"), seedDb });

    await seedDB(facade, (descriptor) => String(descriptor));

    expect(JSON.parse(seedDb.mock.calls[0]![0]).settings.interface.language).toBe(language);
  });
});
