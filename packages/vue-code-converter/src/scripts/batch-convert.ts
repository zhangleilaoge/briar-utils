#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { convert } from '../converter';
import chalk from 'chalk';

interface IResult {
  path: string;
  desc: string;
}

const readVueFiles = (dir: string): string[] => {
  if (dir.endsWith('.vue')) {
    return [dir];
  }
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(readVueFiles(filePath));
    } else if (file.endsWith('.vue')) {
      results.push(filePath);
    }
  });
  return results;
};

const convertDoneLog = ({
  startTime,
  successFiles,
  skipFiles,
  warnings,
  fails,
}: {
  startTime: number;
  successFiles: string[];
  skipFiles: string[];
  warnings: IResult[];
  fails: IResult[];
}) => {
  console.log(`\nConverted successfully in ${Date.now() - startTime}ms.\n`);
  console.log(chalk.green('success:'), successFiles.length);
  console.log(chalk.gray('skip:'), skipFiles.length);
  console.log(chalk.yellow('warning:'), warnings.length);
  console.log(chalk.red('fail:'), fails.length);

  warnings.forEach((warningItem, i) => {
    console.log(
      `${i === 0 ? '\n' : ''}${chalk.yellow('warning')} ${
        warningItem.desc
      }\n   at ${chalk.gray(warningItem.path)}`
    );
  });

  fails.forEach((failItem, i) => {
    console.log(
      `${i === 0 ? '\n' : ''}${chalk.red('fail')} ${
        failItem.desc
      }\n   at ${chalk.grey(failItem.path)}`
    );
  });
};

export const batchConvert = async (range: string) => {
  const successFiles: string[] = [];
  const fails: IResult[] = [];
  const skipFiles: string[] = [];
  const warnings: IResult[] = [];
  const startTime = Date.now();

  console.log(
    `All .vue files in the ${range} directory will be converted.\n\nStart converting...\n`
  );

  const vueFiles = readVueFiles(range);

  vueFiles.forEach(async (file, i) => {
    const content = fs.readFileSync(file, 'utf-8');

    console.log(chalk.gray(`Convert ${file}, ${i + 1}/${vueFiles.length}`));

    try {
      const { output: convertedContent, warning } = convert(content, {
        strict: true,
        prettier: {},
      });
      if (convertedContent === content) {
        skipFiles.push(file);
        return;
      }

      fs.writeFileSync(file, convertedContent, 'utf-8');

      if (warning) {
        warnings.push({ path: file, desc: warning });
        return;
      }

      successFiles.push(file);
    } catch (error) {
      fails.push({
        path: file,
        desc: (error as any)?.message || JSON.stringify(error),
      });
    }
  });

  convertDoneLog({
    startTime,
    successFiles,
    skipFiles,
    warnings,
    fails,
  });
};
