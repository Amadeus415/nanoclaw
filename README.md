# NanoClaw

Personal Qwen assistant for WhatsApp.

## Quick Start

```bash
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw
npm install
./container/build.sh
npm run auth
LOG_LEVEL=debug npm run dev
```

Use a `.env` with:

```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3-coder-plus
ASSISTANT_NAME=Andy
ASSISTANT_HAS_OWN_NUMBER=false
```

## Current Runtime

- WhatsApp input and output
- Qwen Code in isolated containers
- Per-group `QWEN.md` memory files
- Per-group `.qwen` session state
- Scheduled tasks via MCP tools
- File tools and sandboxed shell

The current harness does not expose dedicated browser automation, web-search tools, or agent swarms.

## Memory

- `groups/global/QWEN.md`
- `groups/{name}/QWEN.md`
- `data/sessions/{group}/.qwen/`

Legacy `CLAUDE.md` and `MEMORY.md` files are migrated to `QWEN.md` when there is a single clear source file. If both legacy files exist, NanoClaw leaves them in place and logs a warning.

## Architecture

```text
WhatsApp (baileys) -> SQLite -> polling loop -> container -> Qwen Code -> response
```

Useful files:

- `src/index.ts`
- `src/container-runner.ts`
- `container/agent-runner/src/index.ts`
- `container/agent-runner/src/ipc-mcp-stdio.ts`
- `src/task-scheduler.ts`
- `src/db.ts`

## Docs

- `docs/SECURITY.md`
- `docs/SPEC.md`
- `docs/REQUIREMENTS.md`
- `docs/DEBUG_CHECKLIST.md`

## License

MIT
