import { ERROR_MESSAGES } from "@koloda/app";
import type { ErrorCode, FormError } from "@koloda/app";
import { useLingui } from "@lingui/react";
import { ErrorMessage } from "../../ui/error-message";

type FormErrorsProps = {
  errors: Record<number | string, FormError[]> | FormError[] | undefined;
};

export function Errors({ errors }: FormErrorsProps) {
  if (!errors) return null;

  const flattenedErrors = (Array.isArray(errors) ? errors : Object.values(errors).flat()) as FormError[];
  const uniqueErrors = Array.from(new Map(flattenedErrors.map((error) => [error.message, error])).values());

  return (
    <div className="flex flex-col gap-2" role="alert">
      {uniqueErrors.map((error) => (
        <ErrorsItem error={error} key={error.message} />
      ))}
    </div>
  );
}

type ErrorsItemProps = { error: FormError };

function ErrorsItem({ error }: ErrorsItemProps) {
  const { _ } = useLingui();
  const content = ERROR_MESSAGES[error.message as ErrorCode] ?? ERROR_MESSAGES.unknown;
  const message = typeof content === "function" ? _(content(error)) : _(content);

  return <ErrorMessage layout="inline" message={message} details={error.details} />;
}
