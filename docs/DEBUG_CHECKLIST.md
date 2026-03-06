# NanoClaw Debug Checklist

## Quick Status Check

```bash
# Is the app running?
launchctl list | grep nanoclaw

# Any running containers?
container ls --format '{{.Names}} {{.Status}}' 2>/dev/null | grep nanoclaw

# Recent warnings and errors
grep -E 'ERROR|WARN' logs/nanoclaw.log | tail -20

# WhatsApp connection state
grep -E 'connected to WA|Connection closed|WhatsApp session rejected' logs/nanoclaw.log | tail -10
```

## Qwen Harness Checks

```bash
# Group Qwen session state
find data/sessions -maxdepth 3 -type d | grep '\.qwen'

# Current Qwen settings for a group
cat data/sessions/<group>/.qwen/settings.json

# Confirm only QWEN.md is configured as the context file
grep -n 'QWEN.md' data/sessions/<group>/.qwen/settings.json
```

## Memory File Checks

```bash
# Find any remaining legacy memory files
find . -name 'CLAUDE.md' -o -name 'MEMORY.md'

# Inspect canonical memory files
find groups -maxdepth 2 -name 'QWEN.md' -print
```

If a folder contains both `CLAUDE.md` and `MEMORY.md` but no `QWEN.md`, NanoClaw will leave them in place and log a warning instead of guessing which file to keep.

## Container And Output Checks

```bash
# Recent container lifecycle logs
grep -E 'Spawning container|Container timeout|Agent output|timed out' logs/nanoclaw.log | tail -20

# Recent per-container logs
ls -lt groups/*/logs/container-*.log | head -10

# Inspect the most recent container log
cat groups/<group>/logs/container-<timestamp>.log
```

## IPC Snapshot Checks

```bash
# Current task snapshot for a group
cat data/ipc/<group>/current_tasks.json

# Available groups snapshot (main only)
cat data/ipc/main/available_groups.json
```

## WhatsApp Auth Checks

```bash
# Auth files exist?
ls -la store/auth/

# Re-authenticate if needed
npm run auth
```

If you see repeated session rejection logs, remove the stale auth directory and authenticate again.

## Service Management

```bash
# Restart service
launchctl kickstart -k gui/$(id -u)/com.nanoclaw

# Follow logs live
tail -f logs/nanoclaw.log

# Stop service
launchctl bootout gui/$(id -u)/com.nanoclaw

# Start service
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.nanoclaw.plist
```
