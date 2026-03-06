# NanoClaw Requirements

## Goal

NanoClaw should remain a small personal agent runtime:

- one host process
- isolated agent execution in containers
- WhatsApp as the primary control surface
- persistent memory and sessions per group
- scheduled tasks
- direct code-level customization

## Core Principles

### Small Enough To Read

The codebase should stay understandable without a large framework or service mesh.

### Isolation First

Security should come mainly from mounts and containers, not soft permission prompts.

### Built For A Single Operator

This is not meant to be a giant multi-tenant platform. The main channel is an admin surface for one trusted user.

### Code Over Config Sprawl

Small, explicit code changes are preferred over large configuration layers.

### AI-Friendly, Not AI-Dependent

The repo should be easy to work on with a coding agent, but it should not depend on a specific provider-branded workflow.

## Runtime Requirements

- WhatsApp transport via `@whiskeysockets/baileys`
- SQLite for messages, sessions, groups, and tasks
- Qwen Code via the Qwen SDK
- OpenAI-compatible provider credentials
- Docker or Apple Container for isolation

## Memory Requirements

- Canonical memory filename is `QWEN.md`
- Global memory: `groups/global/QWEN.md`
- Per-group memory: `groups/{name}/QWEN.md`
- Qwen provider state: `data/sessions/{group}/.qwen/`

Legacy `CLAUDE.md` and `MEMORY.md` files may still exist on upgraded installs, but new behavior should treat them as migration sources only.

## Tooling Requirements

The active harness should expose:

- file read/write/edit tools
- sandboxed shell
- NanoClaw MCP tools for messaging and scheduled tasks

The base runtime should not assume:

- browser automation
- dedicated web-search tools
- multi-agent swarms

Those can be added later, but they should not be described as base functionality unless they are actually shipped.

## Main Channel Requirements

The main group can:

- access the project root
- manage global memory
- register groups
- inspect all tasks
- target other groups when scheduling

Non-main groups should stay isolated from each other.

## Documentation Requirements

User-facing docs should match the actual runtime:

- Qwen terminology, not Claude terminology
- `QWEN.md`, not `CLAUDE.md` or `MEMORY.md`
- `.qwen` session paths, not `.claude`
- current provider env vars, not Anthropic-specific ones
