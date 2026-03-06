# NanoClaw Specification

## Summary

NanoClaw is a single-process host application that:

- connects to WhatsApp
- stores chat state in SQLite
- launches isolated containers for agent execution
- runs Qwen Code inside those containers
- persists per-group memory and sessions
- exposes scheduler and messaging tools over MCP

## High-Level Flow

```text
WhatsApp -> SQLite -> polling loop -> group queue -> container -> Qwen Code -> response
```

## Host Responsibilities

The host process handles:

- WhatsApp connection and authentication
- message persistence
- group registration and routing
- scheduled task execution
- container lifecycle
- IPC with running containers
- filtering provider secrets passed into the container

## Container Responsibilities

Each container runs the Qwen harness and gets:

- `/workspace/group` for the active group
- `/workspace/global` for read-only global memory in non-main groups
- `/workspace/project` for full project access in the main group
- `/workspace/ipc` for host communication
- `/home/node/.qwen` for provider-owned session state

## Memory And Session Model

Canonical memory files:

- `groups/global/QWEN.md`
- `groups/{name}/QWEN.md`

Provider session state:

- `data/sessions/{group}/.qwen/`

Legacy file migration rules:

1. If `QWEN.md` exists, use it.
2. If only `MEMORY.md` exists, rename it to `QWEN.md`.
3. If only `CLAUDE.md` exists, rename it to `QWEN.md`.
4. If both legacy files exist and `QWEN.md` does not, log a warning and do not auto-merge.

## Tool Surface

The base Qwen harness exposes:

- directory listing
- file reads and writes
- glob and grep
- shell commands
- task bookkeeping
- NanoClaw MCP tools

NanoClaw MCP tools include:

- `send_message`
- `schedule_task`
- `list_tasks`
- `pause_task`
- `resume_task`
- `cancel_task`
- `register_group`

The base runtime does not currently expose dedicated browser automation, web-search tools, or agent swarms.

## Main Channel

The main group is the admin surface. It can:

- access the full project mount
- read and write global memory
- inspect all groups
- register new groups
- schedule tasks for other groups

Non-main groups are isolated from each other.

## Provider Configuration

Runtime auth uses OpenAI-compatible env vars:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `QWEN_MODEL`

## Operational Checks

Expected runtime artifacts:

- `groups/*/QWEN.md`
- `data/sessions/*/.qwen/settings.json`
- `data/ipc/*/current_tasks.json`
- `data/ipc/main/available_groups.json`

These files are the fastest way to verify that Qwen session setup, memory migration, and IPC snapshots are working.
