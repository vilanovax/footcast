export interface AiCompletionRequest {
  pipelineStage: string;
  promptVersionId: string;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: object;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, string>;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
}

export interface AiCompletionResult {
  content: string;
  parsed?: unknown;
  usage: AiUsage;
  latencyMs: number;
  provider: string;
  model: string;
}

export interface AiProvider {
  readonly name: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
