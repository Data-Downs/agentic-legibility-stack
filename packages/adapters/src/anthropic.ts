/**
 * AnthropicAdapter — Claude API adapter implementing ServiceAdapter
 *
 * This is the ONLY place in the entire codebase that directly uses
 * the Anthropic SDK. All Claude API calls must route through here.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ServiceAdapter, AdapterConfig, AdapterRequest, AdapterResponse } from "./service-adapter";

export interface AnthropicChatInput {
  systemPrompt: string;
  messages: Array<{ role: string; content: unknown }>;
  tools?: Array<Record<string, unknown>>;
  model?: string;
  maxTokens?: number;
  thinkingBudget?: number;
}

export interface AnthropicChatOutput {
  responseText: string;
  reasoning: string;
  stopReason: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  rawContent: Array<Record<string, unknown>>;
}

export class AnthropicAdapter implements ServiceAdapter {
  readonly type = "anthropic";
  private client: Anthropic | null = null;
  private model = "claude-sonnet-4-5-20250929";
  private maxTokens = 16000;
  private thinkingBudget = 5000;

  initialize(config: AdapterConfig): void {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    if (config.model) this.model = config.model as string;
    if (config.maxTokens) this.maxTokens = config.maxTokens as number;
    if (config.thinkingBudget) this.thinkingBudget = config.thinkingBudget as number;
  }

  isReady(): boolean {
    return this.client !== null;
  }

  async execute(request: AdapterRequest): Promise<AdapterResponse> {
    if (!this.client) {
      return { success: false, error: "Anthropic adapter not initialized" };
    }

    const input = request.input as AnthropicChatInput;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiParams: any = {
      model: input.model || this.model,
      max_tokens: input.maxTokens || this.maxTokens,
      thinking: {
        type: "enabled",
        budget_tokens: input.thinkingBudget || this.thinkingBudget,
      },
      system: input.systemPrompt,
      messages: input.messages,
    };

    if (input.tools && input.tools.length > 0) {
      apiParams.tools = input.tools;
    }

    try {
      const response = await this.client.messages.create(apiParams);

      let responseText = "";
      let reasoning = "";
      const toolCalls: AnthropicChatOutput["toolCalls"] = [];

      for (const block of response.content) {
        if (block.type === "thinking") {
          reasoning = (block as { thinking: string }).thinking;
        } else if (block.type === "text") {
          responseText = (block as { text: string }).text;
        } else if (block.type === "tool_use") {
          const toolBlock = block as { id: string; name: string; input: Record<string, unknown> };
          toolCalls.push({
            id: toolBlock.id,
            name: toolBlock.name,
            input: toolBlock.input,
          });
        }
      }

      const output: AnthropicChatOutput = {
        responseText,
        reasoning,
        stopReason: response.stop_reason || "end_turn",
        toolCalls,
        rawContent: response.content as unknown as Array<Record<string, unknown>>,
      };

      return {
        success: true,
        output,
        metadata: {
          model: response.model,
          stopReason: response.stop_reason,
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async shutdown(): Promise<void> {
    this.client = null;
  }
}
