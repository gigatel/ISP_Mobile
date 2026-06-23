const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function stripBareGithubPatExpression(relativeFile) {
  const filePath = path.join(projectRoot, relativeFile);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const fixed = source
    .split(/\r?\n/)
    .filter(line => !/^\s*github_pat_[A-Za-z0-9_]*;\s*$/.test(line))
    .join('\n');

  if (fixed !== source) {
    fs.writeFileSync(filePath, fixed.endsWith('\n') ? fixed : `${fixed}\n`);
    console.log(`postinstall-fixes: cleaned ${relativeFile}`);
  }
}

stripBareGithubPatExpression(
  'node_modules/react-native-year-month-pickers/index.tsx',
);
