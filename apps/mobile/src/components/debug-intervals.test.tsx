import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { render, screen } from "@testing-library/react-native";
import { activateEnglish } from "../i18n";
import { DebugIntervals } from "./debug-intervals";

describe("DebugIntervals", () => {
  it("shows the interval each grade gives a new card under the starter algorithm", async () => {
    activateEnglish();
    await render(
      <I18nProvider i18n={i18n}>
        <DebugIntervals />
      </I18nProvider>,
    );

    // The starter algorithm's learning steps are 1m and 10m: Again repeats the first, Good moves to the second,
    // and Easy graduates the card to days.
    expect(screen.getByText("Again")).toBeTruthy();
    expect(screen.getByText("1 minute")).toBeTruthy();
    expect(screen.getByText("Good")).toBeTruthy();
    expect(screen.getByText("10 minutes")).toBeTruthy();
    expect(screen.getAllByText(/^\d+ (minutes?|days?)$/)).toHaveLength(4);
    expect(screen.getAllByText(/^\d+ days?$/)).toHaveLength(1);
  });
});
