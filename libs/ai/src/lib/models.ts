export type AIModel = {
  id: string;
  name: string;
  context_length: number;
  supported_reasoning_levels?: Array<{ effort: string; description: string }>;
  default_reasoning_level?: string;
  // WHY: absent means the provider's list did not say; it is not the same as `false`.
  has_image_input?: boolean;
  // WHY: as for images, absent means unknown. A provider whose package cannot send an inline PDF reports `false`.
  has_pdf_input?: boolean;
};

// INVARIANT: the provider's answer wins; the profile's list answers only for models it says nothing about
// (AI-MODEL-INPUT.md §Image Input).
export function modelAcceptsImages(model: AIModel, imageInputModelIds: readonly string[] | undefined): boolean {
  return model.has_image_input ?? imageInputModelIds?.includes(model.id) ?? false;
}

export type ModelParameter = {
  type: "reasoning_effort";
  value: string;
  levels: Array<{ effort: string; description: string }>;
  // WHY: false when the model's source names no default level. The picker then
  // offers Default, and `value` is "" until the user picks a level.
  hasDefault: boolean;
};

export type StreamUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};
