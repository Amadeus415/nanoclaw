import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import fs from 'fs';
import { spawn } from 'child_process';

// Sentinel markers must match container-runner.ts
const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

// Mock config
vi.mock('./config.js', () => ({
  CONTAINER_IMAGE: 'nanoclaw-agent:latest',
  CONTAINER_MAX_OUTPUT_SIZE: 10485760,
  CONTAINER_TIMEOUT: 1800000, // 30min
  DATA_DIR: '/tmp/nanoclaw-test-data',
  GROUPS_DIR: '/tmp/nanoclaw-test-groups',
  IDLE_TIMEOUT: 1800000, // 30min
  TIMEZONE: 'America/Los_Angeles',
}));

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      readFileSync: vi.fn(() => ''),
      readdirSync: vi.fn(() => []),
      statSync: vi.fn(() => ({ isDirectory: () => false })),
      copyFileSync: vi.fn(),
      renameSync: vi.fn(),
    },
  };
});

// Mock mount-security
vi.mock('./mount-security.js', () => ({
  validateAdditionalMounts: vi.fn(() => []),
}));

// Create a controllable fake ChildProcess
function createFakeProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
    kill: ReturnType<typeof vi.fn>;
    pid: number;
  };
  proc.stdin = new PassThrough();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.kill = vi.fn();
  proc.pid = 12345;
  return proc;
}

let fakeProc: ReturnType<typeof createFakeProcess>;
const mockedFs = vi.mocked(fs);
const mockedSpawn = vi.mocked(spawn);
const mockedLogger = vi.mocked(logger);

// Mock child_process.spawn
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: vi.fn(() => fakeProc),
    exec: vi.fn((_cmd: string, _opts: unknown, cb?: (err: Error | null) => void) => {
      if (cb) cb(null);
      return new EventEmitter();
    }),
  };
});

import { runContainerAgent, ContainerOutput } from './container-runner.js';
import { logger } from './logger.js';
import type { RegisteredGroup } from './types.js';

const testGroup: RegisteredGroup = {
  name: 'Test Group',
  folder: 'test-group',
  trigger: '@Andy',
  added_at: new Date().toISOString(),
};

const testInput = {
  prompt: 'Hello',
  groupFolder: 'test-group',
  chatJid: 'test@g.us',
  isMain: false,
};

function emitOutputMarker(proc: ReturnType<typeof createFakeProcess>, output: ContainerOutput) {
  const json = JSON.stringify(output);
  proc.stdout.push(`${OUTPUT_START_MARKER}\n${json}\n${OUTPUT_END_MARKER}\n`);
}

describe('container-runner timeout behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fakeProc = createFakeProcess();
    mockedFs.existsSync.mockImplementation(() => false);
    mockedFs.mkdirSync.mockClear();
    mockedFs.writeFileSync.mockClear();
    mockedFs.renameSync.mockClear();
    mockedFs.readdirSync.mockClear();
    mockedFs.statSync.mockClear();
    mockedFs.statSync.mockImplementation(
      () => ({ isDirectory: () => false }) as ReturnType<typeof fs.statSync>,
    );
    mockedLogger.warn.mockClear();
    mockedSpawn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('timeout after output resolves as success', async () => {
    const onOutput = vi.fn(async () => {});
    const resultPromise = runContainerAgent(
      testGroup,
      testInput,
      () => {},
      onOutput,
    );

    // Emit output with a result
    emitOutputMarker(fakeProc, {
      status: 'success',
      result: 'Here is my response',
      newSessionId: 'session-123',
    });

    // Let output processing settle
    await vi.advanceTimersByTimeAsync(10);

    // Fire the hard timeout (IDLE_TIMEOUT + 30s = 1830000ms)
    await vi.advanceTimersByTimeAsync(1830000);

    // Emit close event (as if container was stopped by the timeout)
    fakeProc.emit('close', 137);

    // Let the promise resolve
    await vi.advanceTimersByTimeAsync(10);

    const result = await resultPromise;
    expect(result.status).toBe('success');
    expect(result.newSessionId).toBe('session-123');
    expect(onOutput).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'Here is my response' }),
    );
  });

  it('timeout with no output resolves as error', async () => {
    const onOutput = vi.fn(async () => {});
    const resultPromise = runContainerAgent(
      testGroup,
      testInput,
      () => {},
      onOutput,
    );

    // No output emitted — fire the hard timeout
    await vi.advanceTimersByTimeAsync(1830000);

    // Emit close event
    fakeProc.emit('close', 137);

    await vi.advanceTimersByTimeAsync(10);

    const result = await resultPromise;
    expect(result.status).toBe('error');
    expect(result.error).toContain('timed out');
    expect(onOutput).not.toHaveBeenCalled();
  });

  it('normal exit after output resolves as success', async () => {
    const onOutput = vi.fn(async () => {});
    const resultPromise = runContainerAgent(
      testGroup,
      testInput,
      () => {},
      onOutput,
    );

    // Emit output
    emitOutputMarker(fakeProc, {
      status: 'success',
      result: 'Done',
      newSessionId: 'session-456',
    });

    await vi.advanceTimersByTimeAsync(10);

    // Normal exit (no timeout)
    fakeProc.emit('close', 0);

    await vi.advanceTimersByTimeAsync(10);

    const result = await resultPromise;
    expect(result.status).toBe('success');
    expect(result.newSessionId).toBe('session-456');
  });

  it('writes Qwen settings that only load QWEN.md', async () => {
    const resultPromise = runContainerAgent(
      testGroup,
      testInput,
      () => {},
    );

    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      '/tmp/nanoclaw-test-data/sessions/test-group/.qwen/settings.json',
      expect.stringContaining('"fileName": "QWEN.md"'),
    );
    expect(mockedFs.writeFileSync).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('CLAUDE.md'),
    );
    expect(mockedFs.writeFileSync).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('MEMORY.md'),
    );

    fakeProc.emit('close', 0);
    await vi.advanceTimersByTimeAsync(10);
    await resultPromise;
  });

  it('migrates MEMORY.md to QWEN.md when no QWEN.md exists', async () => {
    mockedFs.existsSync.mockImplementation((target) =>
      target === '/tmp/nanoclaw-test-groups/test-group/MEMORY.md',
    );

    const resultPromise = runContainerAgent(
      testGroup,
      testInput,
      () => {},
    );

    expect(mockedFs.renameSync).toHaveBeenCalledWith(
      '/tmp/nanoclaw-test-groups/test-group/MEMORY.md',
      '/tmp/nanoclaw-test-groups/test-group/QWEN.md',
    );

    fakeProc.emit('close', 0);
    await vi.advanceTimersByTimeAsync(10);
    await resultPromise;
  });

  it('migrates CLAUDE.md to QWEN.md when no QWEN.md exists', async () => {
    mockedFs.existsSync.mockImplementation((target) =>
      target === '/tmp/nanoclaw-test-groups/test-group/CLAUDE.md',
    );

    const resultPromise = runContainerAgent(
      testGroup,
      testInput,
      () => {},
    );

    expect(mockedFs.renameSync).toHaveBeenCalledWith(
      '/tmp/nanoclaw-test-groups/test-group/CLAUDE.md',
      '/tmp/nanoclaw-test-groups/test-group/QWEN.md',
    );

    fakeProc.emit('close', 0);
    await vi.advanceTimersByTimeAsync(10);
    await resultPromise;
  });

  it('warns and leaves legacy files in place when MEMORY.md and CLAUDE.md both exist', async () => {
    mockedFs.existsSync.mockImplementation((target) =>
      target === '/tmp/nanoclaw-test-groups/test-group/MEMORY.md'
      || target === '/tmp/nanoclaw-test-groups/test-group/CLAUDE.md',
    );

    const resultPromise = runContainerAgent(
      testGroup,
      testInput,
      () => {},
    );

    expect(mockedFs.renameSync).not.toHaveBeenCalled();
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      {
        dir: '/tmp/nanoclaw-test-groups/test-group',
        files: ['MEMORY.md', 'CLAUDE.md'],
      },
      'Multiple legacy context files found without QWEN.md; leaving them in place',
    );

    fakeProc.emit('close', 0);
    await vi.advanceTimersByTimeAsync(10);
    await resultPromise;
  });
});
