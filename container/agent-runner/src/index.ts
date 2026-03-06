/**
 * NanoClaw Agent Runner
 * Runs inside a container, receives config via stdin, outputs result to stdout.
 *
 * Input protocol:
 *   Stdin: Full ContainerInput JSON (read until EOF)
 *   IPC:   Follow-up messages written as JSON files to /workspace/ipc/input/
 *          Files: {type:"message", text:"..."}.json — polled and consumed
 *          between query rounds
 *          Sentinel: /workspace/ipc/input/_close — signals session end
 *
 * Stdout protocol:
 *   Each result is wrapped in OUTPUT_START_MARKER / OUTPUT_END_MARKER pairs.
 *   Multiple results may be emitted during a live session.
 *   A final session-update marker signals completion of a prompt round.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { query, type CanUseTool, type ToolInput } from '@qwen-code/sdk';
import { fileURLToPath } from 'url';

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  secrets?: Record<string, string>;
}

interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

const IPC_INPUT_DIR = '/workspace/ipc/input';
const IPC_INPUT_CLOSE_SENTINEL = path.join(IPC_INPUT_DIR, '_close');
const IPC_POLL_MS = 500;

const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

const DEFAULT_MODEL = 'qwen3-coder-plus';
const QWEN_CORE_TOOLS = [
  'list_directory',
  'read_file',
  'glob',
  'grep_search',
  'edit',
  'write_file',
  'run_shell_command',
  'todo_write',
];
const QWEN_EXCLUDED_TOOLS = [
  'save_memory',
  'task',
  'skill',
  'web_fetch',
  'web_search',
  'lsp',
];
const SECRET_ENV_VARS = [
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_MODEL',
  'QWEN_MODEL',
];

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

function log(message: string): void {
  console.error(`[agent-runner] ${message}`);
}

function shouldClose(): boolean {
  if (fs.existsSync(IPC_INPUT_CLOSE_SENTINEL)) {
    try {
      fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
    } catch {
      // Ignore cleanup failures.
    }
    return true;
  }
  return false;
}

function drainIpcInput(): string[] {
  try {
    fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
    const files = fs.readdirSync(IPC_INPUT_DIR)
      .filter((file) => file.endsWith('.json'))
      .sort();

    const messages: string[] = [];
    for (const file of files) {
      const filePath = path.join(IPC_INPUT_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        fs.unlinkSync(filePath);
        if (data.type === 'message' && data.text) {
          messages.push(data.text);
        }
      } catch (err) {
        log(`Failed to process input file ${file}: ${err instanceof Error ? err.message : String(err)}`);
        try {
          fs.unlinkSync(filePath);
        } catch {
          // Ignore cleanup failures.
        }
      }
    }
    return messages;
  } catch (err) {
    log(`IPC drain error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

function waitForIpcMessage(): Promise<string | null> {
  return new Promise((resolve) => {
    const poll = () => {
      if (shouldClose()) {
        resolve(null);
        return;
      }
      const messages = drainIpcInput();
      if (messages.length > 0) {
        resolve(messages.join('\n'));
        return;
      }
      setTimeout(poll, IPC_POLL_MS);
    };
    poll();
  });
}

function createCanUseTool(): CanUseTool {
  return async (toolName, input, _options) => {
    if (toolName !== 'run_shell_command') {
      return {
        behavior: 'allow',
        updatedInput: input,
      };
    }

    const command = typeof input.command === 'string' ? input.command : null;
    if (!command) {
      return {
        behavior: 'allow',
        updatedInput: input,
      };
    }

    const sanitizedInput: ToolInput = {
      ...input,
      command: `unset ${SECRET_ENV_VARS.join(' ')} 2>/dev/null; ${command}`,
    };
    return {
      behavior: 'allow',
      updatedInput: sanitizedInput,
    };
  };
}

function getModel(sdkEnv: Record<string, string | undefined>): string {
  return sdkEnv.OPENAI_MODEL || sdkEnv.QWEN_MODEL || DEFAULT_MODEL;
}

async function runQuery(
  prompt: string,
  sessionId: string,
  resume: boolean,
  mcpServerPath: string,
  containerInput: ContainerInput,
  sdkEnv: Record<string, string | undefined>,
): Promise<void> {
  let messageCount = 0;
  let resultCount = 0;
  const logLevel = process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace'
    ? 'debug'
    : 'error';

  for await (const message of query({
    prompt,
    options: {
      cwd: '/workspace/group',
      model: getModel(sdkEnv),
      authType: 'openai',
      resume: resume ? sessionId : undefined,
      sessionId: resume ? undefined : sessionId,
      env: sdkEnv as Record<string, string>,
      permissionMode: 'default',
      canUseTool: createCanUseTool(),
      coreTools: QWEN_CORE_TOOLS,
      excludeTools: QWEN_EXCLUDED_TOOLS,
      mcpServers: {
        nanoclaw: {
          command: 'node',
          args: [mcpServerPath],
          env: {
            NANOCLAW_CHAT_JID: containerInput.chatJid,
            NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
            NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
          },
        },
      },
      stderr: (stderrMessage) => {
        for (const line of stderrMessage.trim().split('\n')) {
          if (line) {
            log(line);
          }
        }
      },
      logLevel,
    },
  })) {
    messageCount++;
    const msgType = message.type === 'system'
      ? `system/${message.subtype}`
      : message.type;
    log(`[msg #${messageCount}] type=${msgType}`);

    if (message.type === 'system' && message.subtype === 'init') {
      log(`Session initialized: ${message.session_id}`);
    }

    if (message.type === 'result') {
      resultCount++;
      if (message.subtype === 'success') {
        const textResult = typeof message.result === 'string' ? message.result : null;
        log(`Result #${resultCount}: success${textResult ? ` text=${textResult.slice(0, 200)}` : ''}`);
        writeOutput({
          status: 'success',
          result: textResult,
          newSessionId: sessionId,
        });
      } else {
        const errorMessage = typeof message.error?.message === 'string'
          ? message.error.message
          : `Qwen error (${message.subtype})`;
        log(`Result #${resultCount}: ${message.subtype} error=${errorMessage}`);
        writeOutput({
          status: 'error',
          result: null,
          newSessionId: sessionId,
          error: errorMessage,
        });
      }
    }
  }

  log(`Query done. Messages: ${messageCount}, results: ${resultCount}`);
}

async function main(): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    try {
      fs.unlinkSync('/tmp/input.json');
    } catch {
      // Temp file may not exist.
    }
    log(`Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`,
    });
    process.exit(1);
  }

  const sdkEnv: Record<string, string | undefined> = { ...process.env };
  for (const [key, value] of Object.entries(containerInput.secrets || {})) {
    sdkEnv[key] = value;
  }
  const qwenEnv = Object.fromEntries(
    Object.entries(sdkEnv).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

  let sessionId = containerInput.sessionId || randomUUID();
  let resume = !!containerInput.sessionId;
  let allowFreshSessionFallback = !!containerInput.sessionId;
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });

  try {
    fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
  } catch {
    // Ignore stale sentinel cleanup failures.
  }

  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
  }
  const pending = drainIpcInput();
  if (pending.length > 0) {
    log(`Draining ${pending.length} pending IPC messages into initial prompt`);
    prompt += '\n' + pending.join('\n');
  }

  try {
    while (true) {
      log(`Starting query (session: ${sessionId}, resume: ${resume})...`);

      try {
        await runQuery(
          prompt,
          sessionId,
          resume,
          mcpServerPath,
          containerInput,
          qwenEnv,
        );
        allowFreshSessionFallback = false;
      } catch (err) {
        if (resume && allowFreshSessionFallback) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          log(`Resume failed for session ${sessionId}, starting fresh session: ${errorMessage}`);
          sessionId = randomUUID();
          resume = false;
          allowFreshSessionFallback = false;
          continue;
        }
        throw err;
      }
      resume = true;

      writeOutput({ status: 'success', result: null, newSessionId: sessionId });

      log('Query ended, waiting for next IPC message...');
      const nextMessage = await waitForIpcMessage();
      if (nextMessage === null) {
        log('Close sentinel received, exiting');
        break;
      }

      log(`Got new message (${nextMessage.length} chars), starting new query`);
      prompt = nextMessage;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Agent error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      newSessionId: sessionId,
      error: errorMessage,
    });
    process.exit(1);
  }
}

main();
