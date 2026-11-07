"use strict";
// ============================================================================
// MyCo Action — LLM Provider Client
// Direct customer-to-LLM execution (zero intermediate server).
// Supports OpenAI, Anthropic, Groq, DeepSeek, and LiteLLM.
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicDirectClient = exports.OpenAICompatibleClient = void 0;
exports.createActionLLMClient = createActionLLMClient;
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
class OpenAICompatibleClient {
    client;
    modelName;
    constructor(apiKey, modelOverride, baseURL) {
        const defaultBase = "https://api.openai.com/v1";
        const rawBase = baseURL || process.env.MYCO_LLM_BASE_URL || process.env.OPENAI_BASE_URL || process.env.LITELLM_BASE_URL;
        const base = rawBase && rawBase.trim() !== "" ? rawBase.trim() : defaultBase;
        const rawModel = modelOverride || process.env.MYCO_LLM_MODEL || process.env.LLM_MODEL || process.env.OPENAI_MODEL;
        this.modelName = rawModel && rawModel.trim() !== "" ? rawModel.trim() : "gpt-4o";
        this.client = new openai_1.default({
            apiKey,
            baseURL: base,
            timeout: 300_000,
            maxRetries: 2,
        });
    }
    async generate(prompt) {
        const res = await this.client.chat.completions.create({
            model: this.modelName,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
        });
        return res.choices[0]?.message?.content || "";
    }
}
exports.OpenAICompatibleClient = OpenAICompatibleClient;
class AnthropicDirectClient {
    client;
    modelName;
    constructor(apiKey, modelOverride) {
        const rawModel = modelOverride || process.env.MYCO_LLM_MODEL || process.env.LLM_MODEL || process.env.ANTHROPIC_MODEL;
        this.modelName = rawModel && rawModel.trim() !== "" ? rawModel.trim() : "claude-3-5-sonnet-20241022";
        this.client = new sdk_1.default({
            apiKey,
            timeout: 300_000,
            maxRetries: 2,
        });
    }
    async generate(prompt) {
        const res = await this.client.messages.create({
            model: this.modelName,
            max_tokens: 8192,
            messages: [{ role: "user", content: prompt }],
        });
        const block = res.content[0];
        if (block && block.type === "text") {
            return block.text;
        }
        return "";
    }
}
exports.AnthropicDirectClient = AnthropicDirectClient;
function createActionLLMClient(modelOverride) {
    const genericKey = (process.env.MYCO_LLM_API_KEY ||
        process.env.INPUT_MYCO_LLM_API_KEY ||
        process.env.LLM_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        "").trim();
    if (!genericKey) {
        throw new Error("Missing LLM credentials: Set MYCO_LLM_API_KEY in your GitHub repository secrets (Settings -> Secrets and variables -> Actions).");
    }
    let provider = (process.env.MYCO_LLM_PROVIDER ||
        process.env.INPUT_MYCO_LLM_PROVIDER ||
        process.env.LLM_PROVIDER ||
        "").trim().toLowerCase();
    if (!provider) {
        if (genericKey.startsWith("sk-ant-") || process.env.ANTHROPIC_API_KEY) {
            provider = "anthropic";
        }
        else {
            provider = "openai";
        }
    }
    const rawBaseURL = (process.env.MYCO_LLM_BASE_URL ||
        process.env.INPUT_MYCO_LLM_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        process.env.LITELLM_BASE_URL ||
        "").trim();
    const effectiveBaseURL = rawBaseURL && rawBaseURL !== "" ? rawBaseURL : "https://api.openai.com/v1";
    if (provider === "anthropic") {
        return new AnthropicDirectClient(genericKey, modelOverride);
    }
    return new OpenAICompatibleClient(genericKey, modelOverride, effectiveBaseURL);
}
