// inspired by: https://stackoverflow.com/questions/42155115/how-to-include-git-revision-into-angular-cli-application

// const fs = require('fs');
// const { exec, execSync } = require('child_process');
// const revision = process.env.execSync('git rev-parse --short HEAD').toString().trim();
// const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

const version = process.env.npm_package_version || 'NO_VER';
const revision = process.env.GITHUB_SHA || 'NO_REV';
const branch = process.env.GITHUB_SHA || 'NO_BRANCH';

const content = `// this file is automatically generated by git.version.ts script
export const versions = {
  version: '${process.env.npm_package_version}',
  revision: '${revision}',
  branch: '${branch}',
};
`;
console.log(`version: '${version}', revision: '${revision}', branch: '${branch}'`);
fs.writeFileSync('src/environments/versions.ts', content, { encoding: 'utf8' });
