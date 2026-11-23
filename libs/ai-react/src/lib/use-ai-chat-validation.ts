export type UseAIChatValidationOptions = {
  profileId: string;
  modelId: string;
  prompt: string;
  hasImages: boolean;
  // WHY: the draft or the history holds images the selected model does not accept (ASSISTANT-MESSAGES.md
  // §Attaching Images); submit stays blocked rather than dropping them.
  areImagesBlocked: boolean;
  isLoading: boolean;
  hasRequiredSecrets: boolean;
  isModelsLoading: boolean;
  isModelsError: boolean;
};

type UseAIChatValidationReturn = {
  canSubmit: boolean;
  canCancel: boolean;
  showMissingSecretsWarning: boolean;
};

export function useAIChatValidation({
  profileId,
  modelId,
  prompt,
  hasImages,
  areImagesBlocked,
  isLoading,
  hasRequiredSecrets,
  isModelsLoading,
  isModelsError,
}: UseAIChatValidationOptions): UseAIChatValidationReturn {
  const canSubmit = !!(
    profileId &&
    modelId &&
    (!!prompt || hasImages) &&
    !areImagesBlocked &&
    !isLoading &&
    hasRequiredSecrets &&
    !isModelsLoading &&
    // WHY: The model picker already surfaces model-list fetch errors (error row + retry).
    // No chat-level banner; submit just stays disabled until the list loads.
    !isModelsError
  );
  const canCancel = isLoading;
  const showMissingSecretsWarning = !!profileId && !hasRequiredSecrets;

  return { canSubmit, canCancel, showMissingSecretsWarning };
}
