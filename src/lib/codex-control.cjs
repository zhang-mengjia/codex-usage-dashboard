const fs = require("node:fs");

function normalizeRolloutPath(filePath) {
  return String(filePath || "").replace(/^\\\\\?\\/, "");
}

function readLatestTokenUsage(filePath, maxBytes = 16 * 1024 * 1024) {
  const normalized = normalizeRolloutPath(filePath);
  if (!normalized || !fs.existsSync(normalized)) return null;
  const stat = fs.statSync(normalized);
  const length = Math.min(stat.size, maxBytes);
  const buffer = Buffer.alloc(length);
  const descriptor = fs.openSync(normalized, "r");
  try {
    fs.readSync(descriptor, buffer, 0, length, stat.size - length);
  } finally {
    fs.closeSync(descriptor);
  }

  const lines = buffer.toString("utf8").split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.includes('"type":"token_count"')) continue;
    try {
      const value = JSON.parse(line);
      const info = value?.payload?.info;
      if (!info) continue;
      const usedTokens = Number(info.last_token_usage?.total_tokens) || 0;
      const contextWindow = Number(info.model_context_window) || 0;
      return {
        usedTokens,
        contextWindow,
        usedPercent: contextWindow > 0 ? Math.min(100, Math.round((usedTokens / contextWindow) * 100)) : 0,
        inputTokens: Number(info.last_token_usage?.input_tokens) || 0,
        cachedInputTokens: Number(info.last_token_usage?.cached_input_tokens) || 0,
        outputTokens: Number(info.last_token_usage?.output_tokens) || 0,
        reasoningTokens: Number(info.last_token_usage?.reasoning_output_tokens) || 0,
        updatedAt: value.timestamp || null,
      };
    } catch {
      // Continue scanning older token-count events.
    }
  }
  return null;
}

function normalizeThread(thread) {
  return {
    id: thread.id,
    name: thread.name || thread.preview?.split(/\r?\n/)[0]?.slice(0, 72) || "未命名对话",
    preview: thread.preview || "",
    cwd: thread.cwd || "",
    path: thread.path || null,
    updatedAt: Number(thread.updatedAt) || null,
    status: thread.status?.type || "unknown",
  };
}

class CodexControlService {
  constructor(client) {
    this.client = client;
    this.selectedThreadId = null;
    this.collaborationModes = new Map();
    this.planModeByThread = new Map();
    this.state = null;
  }

  async refresh() {
    await this.client.start();
    const [configResponse, modesResponse, threadsResponse] = await Promise.all([
      this.client.request("config/read", { includeLayers: false }),
      this.client.request("collaborationMode/list", {}),
      this.client.request("thread/list", {
        limit: 12,
        sortKey: "updated_at",
        sortDirection: "desc",
        archived: false,
        useStateDbOnly: true,
      }),
    ]);
    const [accountResponse, modelsResponse] = await Promise.all([
      this.client.request("account/read", { refreshToken: false }).catch(() => ({ account: null })),
      this.client.request("model/list", { limit: 100, includeHidden: false }).catch(() => ({ data: [] })),
    ]);

    const threads = (threadsResponse.data || []).map(normalizeThread);
    if (!threads.some((thread) => thread.id === this.selectedThreadId)) {
      this.selectedThreadId = threads[0]?.id || null;
    }
    const selectedThread = threads.find((thread) => thread.id === this.selectedThreadId) || null;
    const modes = modesResponse.data || [];
    this.collaborationModes = new Map(modes.filter((mode) => mode.mode).map((mode) => [mode.mode, mode]));

    let session = null;
    let goal = null;
    let permissionsResponse = { data: [] };
    if (selectedThread) {
      [session, goal, permissionsResponse] = await Promise.all([
        this.client.request("thread/resume", { threadId: selectedThread.id, excludeTurns: true }),
        this.client.request("thread/goal/get", { threadId: selectedThread.id }),
        this.client.request("permissionProfile/list", { cwd: selectedThread.cwd }),
      ]);
    } else {
      permissionsResponse = await this.client.request("permissionProfile/list", {});
    }

    const models = (modelsResponse.data || []).map((model) => ({
      id: model.id,
      model: model.model,
      displayName: model.displayName,
      description: model.description,
      isDefault: Boolean(model.isDefault),
      efforts: (model.supportedReasoningEfforts || []).map((option) => ({
        id: option.reasoningEffort,
        description: option.description,
      })),
      serviceTiers: (model.serviceTiers || []).map((tier) => ({
        id: tier.id,
        name: tier.name,
        description: tier.description,
      })),
    }));

    const config = configResponse.config || {};
    const account = accountResponse.account || null;
    this.state = {
      account: account
        ? {
            type: account.type,
            email: account.email || null,
            planType: account.planType || null,
          }
        : null,
      threads,
      selectedThreadId: this.selectedThreadId,
      context: selectedThread
        ? {
            ...selectedThread,
            tokenUsage: readLatestTokenUsage(selectedThread.path),
          }
        : null,
      catalog: {
        models,
        permissions: (permissionsResponse.data || []).filter((profile) => profile.allowed),
        collaborationModes: modes,
      },
      settings: {
        model: session?.model || config.model || models.find((model) => model.isDefault)?.id || null,
        reasoningEffort: session?.reasoningEffort || config.model_reasoning_effort || null,
        serviceTier: session?.serviceTier || config.service_tier || "default",
        permission: session?.activePermissionProfile?.id || config.default_permissions || ":workspace",
        approvalPolicy: session?.approvalPolicy || config.approval_policy || null,
        sandboxType: session?.sandbox?.type || config.sandbox_mode || null,
        planMode: this.planModeByThread.get(this.selectedThreadId) || "default",
      },
      goal: goal?.goal || null,
      updatedAt: Date.now(),
    };
    return this.state;
  }

  async selectThread(threadId) {
    this.selectedThreadId = threadId;
    return this.refresh();
  }

  async updateSetting(kind, value) {
    if (!this.selectedThreadId) throw new Error("没有可控制的对话");
    const threadId = this.selectedThreadId;
    await this.client.request("thread/resume", { threadId, excludeTurns: true });

    if (kind === "model") {
      await this.#writeConfig("model", value);
      await this.client.request("thread/settings/update", { threadId, model: value });
    } else if (kind === "reasoningEffort") {
      await this.#writeConfig("model_reasoning_effort", value);
      await this.client.request("thread/settings/update", { threadId, effort: value });
    } else if (kind === "serviceTier") {
      await this.#writeConfig("service_tier", value);
      await this.client.request("thread/settings/update", { threadId, serviceTier: value });
    } else if (kind === "permission") {
      await this.#writeConfig("default_permissions", value);
      await this.client.request("thread/settings/update", { threadId, permissions: value });
    } else if (kind === "planMode") {
      const preset = this.collaborationModes.get(value);
      if (!preset) throw new Error(`不支持的协作模式: ${value}`);
      const currentModel = this.state?.settings?.model || "";
      const currentEffort = this.state?.settings?.reasoningEffort || null;
      await this.client.request("thread/settings/update", {
        threadId,
        collaborationMode: {
          mode: value,
          settings: {
            model: preset.model || currentModel,
            reasoning_effort: preset.reasoning_effort ?? currentEffort,
            developer_instructions: null,
          },
        },
      });
      this.planModeByThread.set(threadId, value);
    } else {
      throw new Error(`未知设置项: ${kind}`);
    }
    return this.refresh();
  }

  async compactSelectedThread() {
    if (!this.selectedThreadId) throw new Error("没有可压缩的对话");
    await this.client.request("thread/resume", { threadId: this.selectedThreadId, excludeTurns: true });
    await this.client.request("thread/compact/start", { threadId: this.selectedThreadId });
    return { started: true, threadId: this.selectedThreadId };
  }

  async setGoal(enabled, objective) {
    if (!this.selectedThreadId) throw new Error("没有可设置目标的对话");
    if (enabled) {
      const normalized = String(objective || "").trim();
      if (!normalized) throw new Error("请先填写目标内容");
      await this.client.request("thread/goal/set", {
        threadId: this.selectedThreadId,
        objective: normalized,
        status: "active",
      });
    } else {
      await this.client.request("thread/goal/clear", { threadId: this.selectedThreadId });
    }
    return this.refresh();
  }

  async #writeConfig(keyPath, value) {
    return this.client.request("config/value/write", {
      keyPath,
      value,
      mergeStrategy: "replace",
    });
  }
}

module.exports = {
  CodexControlService,
  normalizeRolloutPath,
  normalizeThread,
  readLatestTokenUsage,
};
