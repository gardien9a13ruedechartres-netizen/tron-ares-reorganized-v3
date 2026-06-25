import { spawn } from 'node:child_process';
import process from 'node:process';

const cwd = process.cwd();
const command = 'npm run deploy:once';

function openShell() {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', command], {
      cwd,
      detached: true,
      stdio: 'ignore'
    }).unref();
    return;
  }

  if (process.platform === 'darwin') {
    const appleScript = `tell application "Terminal" to do script "cd ${cwd.replace(/"/g, '\\"')} && ${command}"`;
    spawn('osascript', ['-e', appleScript], {
      detached: true,
      stdio: 'ignore'
    }).unref();
    return;
  }

  const terminals = [
    ['gnome-terminal', ['--', 'bash', '-lc', `${command}; echo; read -p "Appuie sur Entrée pour fermer..."`]],
    ['konsole', ['-e', 'bash', '-lc', `${command}; echo; read -p "Appuie sur Entrée pour fermer..."`]],
    ['xfce4-terminal', ['--command', `bash -lc '${command}; echo; read -p "Appuie sur Entrée pour fermer..."'`]],
    ['xterm', ['-e', `bash -lc '${command}; echo; read -p "Appuie sur Entrée pour fermer..."'`]]
  ];

  for (const [terminal, args] of terminals) {
    try {
      const child = spawn(terminal, args, {
        cwd,
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return;
    } catch {
      // Essaie le terminal suivant.
    }
  }

  console.error('Impossible d’ouvrir un nouveau terminal automatiquement sur ce système.');
  process.exit(1);
}

openShell();
