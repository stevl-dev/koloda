import { ERROR_MESSAGES, formatAppError } from "@koloda/app";
import { AlertIcon, Button, ErrorMessage, RefreshIcon } from "@koloda/ui";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMutation } from "@tanstack/react-query";
import { webClearDataMutationOptions } from "../app/queries";

export function WebIncompatibleData() {
  const { _ } = useLingui();
  const { mutate, isPending, isError, error } = useMutation(webClearDataMutationOptions);
  const clearError = isError && error ? formatAppError(error, _, ERROR_MESSAGES.unknown) : null;

  const handleClick = () => {
    if (isPending) return;
    // WHY: the open database handle is closed by the clear; a reload opens a fresh one, which reads as blank.
    mutate(undefined, { onSuccess: () => window.location.reload() });
  };

  return (
    <div className="grow flex items-center justify-center my-12 px-4">
      <div className="flex flex-col items-center gap-4 max-w-md text-center fg-level-2">
        <AlertIcon className="size-8 min-w-8" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-pretty">{_(msg`web.incompatible-data.message`)}</p>
        {clearError && <ErrorMessage message={clearError.message} details={clearError.details} />}
        <Button variants={{ style: "primary" }} onClick={handleClick} isDisabled={isPending}>
          {isPending && (
            <RefreshIcon className="size-5 min-w-5 motion:animate-spin" strokeWidth={1.75} aria-hidden="true" />
          )}
          {_(msg`web.incompatible-data.clear`)}
        </Button>
      </div>
    </div>
  );
}
