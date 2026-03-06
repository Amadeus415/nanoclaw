# NanoClaw

面向 WhatsApp 的个人 Qwen 助手。

这个仓库现在只包含可运行的 Qwen 应用。旧的 skills / customization 系统已经从主仓库移除；如果以后恢复，应放到单独的仓库里。

## 快速开始

```bash
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw
npm install
./container/build.sh
npm run auth
LOG_LEVEL=debug npm run dev
```

`.env` 示例：

```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-coder-plus
ASSISTANT_NAME=Andy
ASSISTANT_HAS_OWN_NUMBER=false
```

## 当前运行时

- WhatsApp 收发消息
- 容器中的 Qwen Code
- 每个群组独立的 `QWEN.md`
- 每个群组独立的 `.qwen` 会话状态
- 基于 MCP 的计划任务
- 文件工具和沙箱 shell

当前 harness 不提供专门的浏览器自动化、网页搜索工具或 agent swarm。

## 记忆

- `groups/global/QWEN.md`
- `groups/{name}/QWEN.md`
- `data/sessions/{group}/.qwen/`

旧的 `CLAUDE.md` 和 `MEMORY.md` 会在没有歧义时迁移到 `QWEN.md`。如果同一目录里同时存在两个旧文件，NanoClaw 会保留原状并记录警告。

## 架构

```text
WhatsApp (baileys) -> SQLite -> 轮询循环 -> 容器 -> Qwen Code -> 响应
```

关键文件：

- `src/index.ts`
- `src/container-runner.ts`
- `container/agent-runner/src/index.ts`
- `container/agent-runner/src/ipc-mcp-stdio.ts`
- `src/task-scheduler.ts`
- `src/db.ts`

## 文档

- `docs/SECURITY.md`
- `docs/SPEC.md`
- `docs/REQUIREMENTS.md`
- `docs/DEBUG_CHECKLIST.md`

## 许可证

MIT
