export const AI_PROVIDER_LABELS = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  lmstudio: "LM Studio",
  opencodeGo: "OpenCode Go",
  opencodeZen: "OpenCode Zen",
  ollamaCloud: "Ollama Cloud",
  anthropic: "Anthropic",
  xai: "xAI",
  vercel: "Vercel AI Gateway",
} as const;

export const OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1";
export const OPENCODE_ZEN_BASE_URL = "https://opencode.ai/zen/v1";
export const OLLAMA_CLOUD_BASE_URL = "https://ollama.com";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const XAI_BASE_URL = "https://api.x.ai/v1";

// WHY: Anthropic sends CORS headers only to requests that carry this header, so the web host
// needs it on every call. Desktop calls run in Electron main, where it changes nothing.
export const ANTHROPIC_BROWSER_ACCESS_HEADERS = { "anthropic-dangerous-direct-browser-access": "true" };

export type AiProvider = keyof typeof AI_PROVIDER_LABELS;

export const AI_PROVIDERS = Object.keys(AI_PROVIDER_LABELS) as AiProvider[];
