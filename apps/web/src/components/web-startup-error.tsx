import { ERROR_MESSAGES, formatAppError } from "@koloda/app";
import { Button, KolodaLogo, overlayFrame, SetupBackground } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { WebBootFailure } from "../app/boot";

const startupScreen = "relative min-w-screen min-h-screen flex flex-col items-center justify-center px-4 py-6 bg-body";
const startupCard = overlayFrame({ class: "relative z-1 w-full max-w-lg p-6 wd:p-10 rounded-2xl border-main" });
const startupTitle = "text-[1.625rem] leading-tight font-bold tracking-tight text-balance fg-level-1";
const startupDetails = "mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-sm fg-level-3";

export type WebStartupErrorProps = {
  failure: WebBootFailure;
};

export function WebStartupError({ failure }: WebStartupErrorProps) {
  const { _ } = useLingui();
  const startupError = failure.status === "failed" ? formatAppError(failure.error, _, ERROR_MESSAGES.unknown) : null;

  return (
    <div className={startupScreen}>
      <SetupBackground />
      <section className={startupCard} aria-labelledby="startup-error-title">
        <div className="flex flex-row items-center justify-between mb-10">
          <KolodaLogo className="h-6 w-auto" />
          <span className="fg-level-2 text-sm font-bold tracking-widest">{_(msg`web.setup.demo`)}</span>
        </div>
        <h1 id="startup-error-title" className={startupTitle}>
          {startupError ? _(msg`web.startup.failed.title`) : _(msg`web.startup.unsupported.title`)}
        </h1>
        {startupError ? (
          <>
            {/* WHY: not `ErrorMessage`: its details dialog reads hotkey settings through the store, which never loaded. */}
            <p className="mt-6 fg-error">{startupError.message}</p>
            {startupError.details && <pre className={startupDetails}>{startupError.details}</pre>}
            <Button variants={{ style: "primary", class: "w-full mt-8" }} onClick={() => window.location.reload()}>
              {_(msg`web.startup.reload`)}
            </Button>
          </>
        ) : (
          <p className="mt-3 fg-level-2 leading-relaxed text-pretty">{_(msg`web.startup.unsupported`)}</p>
        )}
      </section>
    </div>
  );
}
