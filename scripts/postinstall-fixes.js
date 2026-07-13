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

function replaceFromFix(relativeFile, fixFile) {
  const filePath = path.join(projectRoot, relativeFile);
  const fixPath = path.join(projectRoot, fixFile);

  if (!fs.existsSync(filePath) || !fs.existsSync(fixPath)) {
    return;
  }

  const fixed = fs.readFileSync(fixPath, 'utf8');
  const source = fs.readFileSync(filePath, 'utf8');

  if (fixed !== source) {
    fs.writeFileSync(filePath, fixed);
    console.log(`postinstall-fixes: replaced ${relativeFile}`);
  }
}

replaceFromFix(
  'node_modules/react-native-year-month-pickers/index.tsx',
  'scripts/fixes/react-native-year-month-pickers-index.tsx',
);

stripBareGithubPatExpression(
  'node_modules/react-native-year-month-pickers/index.tsx',
);
