import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { AIProfileForm } from "./ai-profile-form-fields";
import type { AIProfileFormValues } from "./ai-provider-form-config";
import { isPlainHttpToPublicHost } from "./plain-http-base-url";

export type AIProfilePlainHttpWarningProps = {
  form: AIProfileForm;
  hasStoredKey: boolean;
};

// WHY: a stored key counts even with the API key field blank, since an edit cannot clear an optional key
// (AI-PROVIDERS.md §Editing a Profile). Any header row counts: custom headers often carry the credential.
function isSecretSentOverPlainHttp(values: AIProfileFormValues, hasStoredKey: boolean) {
  const isSendingSecret = hasStoredKey || Boolean(values.apiKey?.trim()) || (values.headers?.length ?? 0) > 0;
  return isSendingSecret && isPlainHttpToPublicHost(values.baseUrl ?? "");
}

export function AIProfilePlainHttpWarning({ form, hasStoredKey }: AIProfilePlainHttpWarningProps) {
  const { _ } = useLingui();

  return (
    <form.Subscribe selector={(state) => isSecretSentOverPlainHttp(state.values, hasStoredKey)}>
      {(isShown) =>
        isShown ? <p className="fg-level-3 text-sm">{_(msg`settings.ai.profiles.plain-http.warning`)}</p> : null
      }
    </form.Subscribe>
  );
}
