# NanoClaw

Personal Qwen assistant. See [README.md](README.md) for setup and [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for architecture intent.

## Quick Context

Single Node.js process that connects to WhatsApp, stores chat state in SQLite, and runs Qwen Code inside isolated containers. Each group gets its own filesystem, `QWEN.md`, IPC namespace, and `.qwen` session state.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main orchestrator and message loop |
| `src/channels/whatsapp.ts` | WhatsApp connect/auth/send/receive |
| `src/container-runner.ts` | Container mounts, `QWEN.md` migration, session persistence |
| `container/agent-runner/src/index.ts` | Qwen SDK harness inside the container |
| `container/agent-runner/src/ipc-mcp-stdio.ts` | MCP tools exposed to the agent |
| `src/ipc.ts` | Host-side IPC watcher for messages and tasks |
| `src/task-scheduler.ts` | Scheduled task execution |
| `src/db.ts` | SQLite storage |
| `groups/global/QWEN.md` | Global shared memory |
| `groups/{name}/QWEN.md` | Per-group memory |

## Harness Notes

- Canonical context file name is `QWEN.md`.
- Legacy `CLAUDE.md` and `MEMORY.md` files are migrated to `QWEN.md` when safe.
- Sessions live in `data/sessions/{group}/.qwen/`.
- The active harness exposes file tools, shell, task tools, and NanoClaw MCP tools.
- There is no dedicated browser tool, web-search tool, or subagent workflow in the current harness.

## Development

Run commands directly.

```bash
npm run dev
npm run build
npm test
./container/build.sh
```
