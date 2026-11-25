export { createAssistantToolExecutor } from "./lib/assistant-tool-executor";
export { ASSISTANT_TOOL_SPECS, generatedCardsFromProposeOutput, isProposeCardsOutput } from "./lib/assistant-tools";
export type { AssistantToolEvent, AssistantToolName, OnToolEvent } from "./lib/assistant-tools";
export {
  computeConversationTitle,
  conversationAttachmentUrl,
  getMessageFiles,
  getTextMessageContent,
  parseConversationAttachmentUrl,
} from "./lib/conversations";
export type { MessageFileRef } from "./lib/conversations";
export { parseAppLinkTarget, replaceAppLinksWithText } from "./lib/app-links";
export type { AppLinkScreen, AppLinkTarget } from "./lib/app-links";
export { AIError, isAIError, toAIError, wrapAIError } from "./lib/error";
export { formatMention, parseMentionText, replaceMentionsWithTitles } from "./lib/mentions";
export type { Mention, MentionKind, MentionTextPart } from "./lib/mentions";
export { chatInputSchema } from "./lib/generation";
export type {
  ChatInput,
  ChatStreamChunk,
  ChatStreamRequest,
  ConversationFile,
  GeneratedCard,
  Message,
  MessageFile,
  MessagePart,
} from "./lib/generation";
export { modelAcceptsImages, modelAcceptsPdf } from "./lib/models";
export type { AIModel, ModelParameter, StreamUsage } from "./lib/models";
export { DEFAULT_CHAT_PROMPT_TEMPLATE, GENERATION_TEMPERATURE } from "./lib/prompts";
export { SETTINGS_CHANGE_ROWS, splitSettingsChangeField } from "./lib/settings-changes";
export type { SettingsChangeField, SettingsChangeRow } from "./lib/settings-changes";
export { AI_PROVIDERS, AI_PROVIDER_LABELS } from "./lib/provider-catalog";
export type { AiProvider } from "./lib/provider-catalog";
export {
  createAIGenerationClient,
  fetchModels,
  getProviderConfig,
  listProvidersThatWorkInBrowser,
} from "./lib/provider-registry";
export {
  aiSecretsInputValidation,
  aiSecretsValidation,
  anthropicSecretsValidation,
  deepseekSecretsValidation,
  isPresentApiKey,
  isValidHeaderName,
  isValidHeaderValue,
  isValidModelId,
  lmstudioSecretsValidation,
  openaiCompatibleSecretsValidation,
  openaiSecretsValidation,
  ollamaCloudSecretsValidation,
  ollamaSecretsValidation,
  openRouterSecretsValidation,
  opencodeGoSecretsValidation,
  opencodeZenSecretsValidation,
  vercelSecretsValidation,
  xaiSecretsValidation,
} from "./lib/provider-secrets";
export type { AISecrets, SecretField } from "./lib/provider-secrets";
export type { AIRuntime } from "./lib/runtime";
export {
  aiProfileValidation,
  aiSettingsValidation,
  assistantSettingsFormSchema,
  assistantSettingsValidation,
  findDuplicateProfileId,
  resolveChatPromptMode,
  resolveEffectiveChatPromptTemplate,
} from "./lib/settings";
export type {
  AIProfile,
  AddAIProfileData,
  AssistantSettings,
  ChatPromptMode,
  RemoveAIProfileData,
  UpdateAIProfileData,
} from "./lib/settings";
