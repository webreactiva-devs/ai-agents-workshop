import { spawn } from 'node:child_process';

const children = [];
let shuttingDown = false;

function start(name, args) {
  const child = spawn('npm', args, {
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    for (const other of children) {
      if (other !== child && !other.killed) {
        other.kill('SIGTERM');
      }
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exitCode = code ?? 0;
  });

  child.on('error', error => {
    console.error(`[${name}] failed to start`, error);
    if (!shuttingDown) {
      shuttingDown = true;
      for (const other of children) {
        if (other !== child && !other.killed) {
          other.kill('SIGTERM');
        }
      }
      process.exitCode = 1;
    }
  });

  children.push(child);
}

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start('mcp-server', ['run', 'dev:mcp-server']);
start('mcp-trace', ['run', 'dev:mcp-trace']);
