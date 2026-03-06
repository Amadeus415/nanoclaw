# NanoClaw Security Model

## Trust Model

| Entity | Trust Level | Rationale |
|--------|-------------|-----------|
| Main group | Trusted | Private admin/control chat |
| Non-main groups | Untrusted | Other users may be malicious |
| Container agents | Sandboxed | Isolated execution environment |
| WhatsApp messages | User input | Potential prompt injection |

## Primary Boundary

NanoClaw relies on container isolation rather than application-level permission prompts.

- Agents only see explicitly mounted paths.
- The container runs as the built-in `node` user.
- Containers are ephemeral and removed after execution.
- Main and non-main groups get different mounts.

## Filesystem Isolation

Per group:

- `/workspace/group` maps to that group folder and is writable.
- `/home/node/.qwen` maps to `data/sessions/{group}/.qwen/`.
- `/workspace/ipc` maps to the group-specific IPC directory.

Non-main groups also get:

- `/workspace/global` mapped read-only from `groups/global/`.

Main group also gets:

- `/workspace/project` mapped read-write to the project root.

## Memory And Session Isolation

- Durable memory lives in `groups/global/QWEN.md` and `groups/{group}/QWEN.md`.
- Provider-owned session state lives in `data/sessions/{group}/.qwen/`.
- Groups do not share `.qwen` state.
- Legacy `CLAUDE.md` and `MEMORY.md` files are migrated to `QWEN.md` only when there is a single clear source file.

## Credential Handling

Only a small allowlist of provider variables is passed into the container:

```ts
[
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_MODEL',
  'QWEN_MODEL',
]
```

Not mounted into containers:

- WhatsApp auth state in `store/auth/`
- Mount allowlist at `~/.config/nanoclaw/mount-allowlist.json`
- Other `.env` values

The current model auth path is OpenAI-compatible API key auth.

## IPC Authorization

The host process enforces chat and group ownership when applying IPC requests:

- Non-main groups can message only their own chat.
- Non-main groups can schedule only for their own group.
- Main group can register groups and target other groups.
- Task visibility is group-scoped except for main.

## Mount Security

Additional mounts are validated before container launch:

- symlinks are resolved before validation
- container paths cannot escape `/workspace/extra/`
- sensitive host paths are blocked
- read-only enforcement can be applied for non-main groups

## Practical Risk Notes

- Agents still have network access from inside the container.
- Sandbox shell access means the model can read anything inside mounted paths.
- Main group is effectively an admin surface because it can access the project root.

That is intentional. The safety model is “small codebase plus strict mounts,” not “powerful host access with soft prompts.”
