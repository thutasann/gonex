// @ts-check
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import pkg from '../package.json' assert { type: 'json' };

// Banner
console.log(
  chalk.greenBright(`
  ██████╗  ██████╗ ███╗   ██╗███████╗██╗  ██╗
  ██╔══██╗██╔═══██╗████╗  ██║██╔════╝██║ ██╔╝
  ██████╔╝██║   ██║██╔██╗ ██║█████╗  █████╔╝ 
  ██╔═══╝ ██║   ██║██║╚██╗██║██╔══╝  ██╔═██╗ 
  ██║     ╚██████╔╝██║ ╚████║███████╗██║  ██╗
  ╚═╝      ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝
`)
);

// Info
console.log(
  chalk.bold.cyan(`\n🌀 Gonex v${pkg.version}`),
  chalk.whiteBright(`– Go-style Concurrency for Node.js\n`)
);

console.log(
  chalk.yellow('⚡ True Parallelism'),
  chalk.gray('•'),
  chalk.yellow('Worker Threads'),
  chalk.gray('•'),
  chalk.yellow('Multi-Core Performance\n')
);

// Example Discovery
const coreExamplesPath = path.resolve('./core');
const exampleDirs = fs
  .readdirSync(coreExamplesPath)
  .filter(file => fs.statSync(path.join(coreExamplesPath, file)).isDirectory());

// List Examples
console.log(chalk.magentaBright('📂 Available Examples:\n'));
exampleDirs.forEach((dir, i) => {
  const name = dir.replace(/[-_]/g, ' ');
  console.log(
    chalk.white(`${String(i + 1).padStart(2)}.`),
    chalk.greenBright(`${name.charAt(0).toUpperCase() + name.slice(1)}`)
  );
});

// Combined Example
console.log(
  '\n' + chalk.white('▶️  Run combined example:'),
  chalk.cyan('node core/combined.js')
);

// Tips
console.log(
  '\n💡 ' +
    chalk.gray(
      'Navigate into any example folder and run it manually to explore specific primitives.'
    ) +
    '\n📖 ' +
    chalk.gray('Check out the full docs at ') +
    chalk.underline.blue('https://www.npmjs.com/package/gonex') +
    '\n'
);

// Exit Message
console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(
  chalk.bold.green('Ready to Go. ⚙️  Write concurrent code like a Gopher!\n')
);
