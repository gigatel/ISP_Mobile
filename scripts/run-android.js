const {spawn} = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'node_modules', 'react-native', 'cli.js');
const jnaOptions = [
  '-Djna.nosys=true',
  '-Djna.nounpack=true',
  '-Djna.boot.library.path=/private/tmp/prefab-jna-empty',
];

const env = {...process.env};
env.JAVA_TOOL_OPTIONS = [jnaOptions.join(' '), env.JAVA_TOOL_OPTIONS]
  .filter(Boolean)
  .join(' ');

const child = spawn(
  process.execPath,
  [cliPath, 'run-android', ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  },
);

child.on('error', error => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
