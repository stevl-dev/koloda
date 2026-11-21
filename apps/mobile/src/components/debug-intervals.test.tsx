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

    // The starter algorithm's first step is 1m, which Again keeps. FSRS-7 lengthens the other grades past the steps:
    // Hard stays under a day, and Good and Easy graduate the card.
    expect(screen.getByText("Again")).toBeTruthy();
    expect(screen.getByText("1 minute")).toBeTruthy();
    expect(screen.getByText("14 hours")).toBeTruthy();
    // WHY: fuzz is on, so Good's few days and Easy's two months shift by a day or so.
    expect(screen.getByText("Good")).toBeTruthy();
    expect(screen.getByText(/^\d+ days$/)).toBeTruthy();
    expect(screen.getByText(/^\d+ months?$/)).toBeTruthy();
  });
});
