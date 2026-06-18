import * as vscode from 'vscode';
import { calculateTextObservability } from './textMetrics';
import { BxModelInfo, BxModelObservability } from './types';

const SELECTED_MODEL_KEY = 'bx.selectedLanguageModel';

export interface BxModelServiceResult {
  text: string;
  model?: BxModelInfo;
  observability: BxModelObservability;
}

export interface BxAvailableModelInfo extends BxModelInfo {
  index: number;
  maxInputTokens?: number;
  raw?: Record<string, unknown>;
}

export interface BxSelectedModelInfo extends BxModelInfo {
  index?: number;
  maxInputTokens?: number;
  selectedAt: string;
}

export class BxModelService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async listModels(): Promise<BxAvailableModelInfo[]> {
    const models = await vscode.lm.selectChatModels({});

    return models.map((model, index) => this.toAvailableModelInfo(model, index));
  }

  getSelectedModel(): BxSelectedModelInfo | undefined {
    return this.context.workspaceState.get<BxSelectedModelInfo>(SELECTED_MODEL_KEY);
  }

  async clearSelectedModel(): Promise<void> {
    await this.context.workspaceState.update(SELECTED_MODEL_KEY, undefined);
  }

  async selectModel(identifier: string): Promise<BxSelectedModelInfo> {
    const models = await this.listModels();
    const selected = this.findModelByIdentifier(models, identifier);

    if (!selected) {
      throw new Error(`Could not find a VS Code language model matching "${identifier}". Run \`@bx /models\` and try an index or id from the list.`);
    }

    const selectedModel: BxSelectedModelInfo = {
      id: selected.id,
      name: selected.name,
      vendor: selected.vendor,
      family: selected.family,
      version: selected.version,
      index: selected.index,
      maxInputTokens: selected.maxInputTokens,
      selectedAt: new Date().toISOString()
    };

    await this.context.workspaceState.update(SELECTED_MODEL_KEY, selectedModel);
    return selectedModel;
  }

  formatModelsAsMarkdown(models: BxAvailableModelInfo[]): string {
    const selected = this.getSelectedModel();

    if (!models.length) {
      return [
        'BX did not find any VS Code language model available to this extension.',
        '',
        'This means `vscode.lm.selectChatModels({})` returned an empty list.',
        '',
        'Check whether your model provider is installed, authenticated, and exposed to the VS Code Language Model API.'
      ].join('\n');
    }

    const lines: string[] = [];
    lines.push('BX available VS Code language models:');
    lines.push('');

    for (const model of models) {
      const selectedMark = this.isSameModel(model, selected) ? ' **[selected]**' : '';
      lines.push(`${model.index}. ${model.name ?? model.id ?? 'Unnamed model'}${selectedMark}`);
      lines.push(`   - vendor: ${model.vendor ?? 'unknown'}`);
      lines.push(`   - family: ${model.family ?? 'unknown'}`);
      lines.push(`   - id: ${model.id ?? 'unknown'}`);

      if (model.version) {
        lines.push(`   - version: ${model.version}`);
      }

      if (typeof model.maxInputTokens === 'number') {
        lines.push(`   - maxInputTokens: ${model.maxInputTokens}`);
      }

      lines.push('');
    }

    lines.push('To select a model explicitly, use:');
    lines.push('');
    lines.push('- `@bx /use-model <index>`');
    lines.push('- `@bx /use-model <id>`');
    lines.push('');
    lines.push('Example for your MiniMax result:');
    lines.push('');
    lines.push('- `@bx /use-model MiniMax-M3-intl`');

    return lines.join('\n');
  }

  formatSelectedModelAsMarkdown(): string {
    const selected = this.getSelectedModel();

    if (!selected) {
      return [
        'BX has no explicit model selected.',
        '',
        'Run `@bx /models` to list available models, then use `@bx /use-model <index>` or `@bx /use-model <id>`.',
        '',
        'Without an explicit selection, BX uses the first model returned by the VS Code Language Model API. That may fall back to Copilot/premium quota.'
      ].join('\n');
    }

    return [
      'BX selected language model:',
      '',
      `- name: ${selected.name ?? 'unknown'}`,
      `- vendor: ${selected.vendor ?? 'unknown'}`,
      `- family: ${selected.family ?? 'unknown'}`,
      `- id: ${selected.id ?? 'unknown'}`,
      `- version: ${selected.version ?? 'unknown'}`,
      typeof selected.maxInputTokens === 'number' ? `- maxInputTokens: ${selected.maxInputTokens}` : undefined,
      `- selectedAt: ${selected.selectedAt}`
    ].filter(Boolean).join('\n');
  }

  formatSelectionResultAsMarkdown(model: BxSelectedModelInfo): string {
    return [
      'BX model selected:',
      '',
      `- name: ${model.name ?? 'unknown'}`,
      `- vendor: ${model.vendor ?? 'unknown'}`,
      `- family: ${model.family ?? 'unknown'}`,
      `- id: ${model.id ?? 'unknown'}`,
      `- version: ${model.version ?? 'unknown'}`,
      typeof model.maxInputTokens === 'number' ? `- maxInputTokens: ${model.maxInputTokens}` : undefined,
      '',
      'Future `@bx` prompts will use this model when possible.'
    ].filter(Boolean).join('\n');
  }

  async ask(prompt: string, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<BxModelServiceResult> {
    const startedAt = Date.now();
    const model = await this.resolveModel();

    if (!model) {
      throw new Error('No VS Code language model is available. Configure GitHub Copilot or another VS Code Language Model provider, then try again.');
    }

    const messages = [
      vscode.LanguageModelChatMessage.User(this.buildSystemInstruction()),
      vscode.LanguageModelChatMessage.User(prompt)
    ];

    const response = await model.sendRequest(messages, {}, token);
    const chunks: string[] = [];

    for await (const chunk of response.text) {
      chunks.push(chunk);
      stream.markdown(chunk);
    }

    const text = chunks.join('');
    const textObservability = calculateTextObservability(text);
    const modelRecord = model as unknown as Record<string, unknown>;

    return {
      text,
      model: {
        id: model.id,
        name: model.name,
        vendor: model.vendor,
        family: model.family,
        version: typeof modelRecord.version === 'string' ? modelRecord.version : undefined
      },
      observability: {
        ...textObservability,
        latencyMs: Date.now() - startedAt,
        streamed: true,
        billingAvailable: false
      }
    };
  }

  private async resolveModel(): Promise<vscode.LanguageModelChat | undefined> {
    const selected = this.getSelectedModel();

    if (!selected) {
      const models = await vscode.lm.selectChatModels({});
      return models[0];
    }

    const selector: vscode.LanguageModelChatSelector = {};

    if (selected.vendor) {
      selector.vendor = selected.vendor;
    }

    if (selected.family) {
      selector.family = selected.family;
    }

    if (selected.version) {
      selector.version = selected.version;
    }

    let models = await vscode.lm.selectChatModels(selector);

    if (!models.length) {
      models = await vscode.lm.selectChatModels({});
    }

    return models.find((model) => this.isSameModel(this.toAvailableModelInfo(model, 0), selected))
      ?? models.find((model) => selected.id && model.id === selected.id)
      ?? models.find((model) => selected.name && model.name === selected.name)
      ?? models[0];
  }

  private toAvailableModelInfo(model: vscode.LanguageModelChat, index: number): BxAvailableModelInfo {
    const modelRecord = model as unknown as Record<string, unknown>;

    return {
      index: index + 1,
      id: model.id,
      name: model.name,
      vendor: model.vendor,
      family: model.family,
      version: typeof modelRecord.version === 'string' ? modelRecord.version : undefined,
      maxInputTokens: typeof modelRecord.maxInputTokens === 'number' ? modelRecord.maxInputTokens : undefined,
      raw: {
        id: model.id,
        name: model.name,
        vendor: model.vendor,
        family: model.family,
        version: modelRecord.version,
        maxInputTokens: modelRecord.maxInputTokens
      }
    };
  }

  private findModelByIdentifier(models: BxAvailableModelInfo[], identifier: string): BxAvailableModelInfo | undefined {
    const trimmed = identifier.trim();
    const index = Number(trimmed);

    if (Number.isInteger(index) && index > 0) {
      return models.find((model) => model.index === index);
    }

    const lower = trimmed.toLowerCase();

    return models.find((model) => model.id?.toLowerCase() === lower)
      ?? models.find((model) => model.name?.toLowerCase() === lower)
      ?? models.find((model) => model.id?.toLowerCase().includes(lower))
      ?? models.find((model) => model.name?.toLowerCase().includes(lower));
  }

  private isSameModel(model: BxModelInfo | undefined, selected: BxModelInfo | undefined): boolean {
    if (!model || !selected) {
      return false;
    }

    if (model.id && selected.id && model.id === selected.id) {
      return true;
    }

    return Boolean(
      model.vendor && selected.vendor && model.vendor === selected.vendor &&
      model.family && selected.family && model.family === selected.family &&
      model.name && selected.name && model.name === selected.name
    );
  }

  private buildSystemInstruction(): string {
    return [
      'You are BX, an AI assistant inside VS Code.',
      'Help the developer with practical software engineering guidance.',
      'When producing code, prefer concise explanations and explicit trade-offs.',
      'If healthcare, CPF, patient, medical record, credential, token, or secret data appears, point out privacy and governance risks.',
      'Do not claim that code was changed unless the user explicitly applied it or you have tool evidence.'
    ].join('\n');
  }
}
