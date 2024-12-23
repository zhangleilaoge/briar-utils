#!/usr/bin/env node
import { Command } from 'commander';
import { batchConvert } from '../scripts/batch-convert';

const program = new Command();

program
  .helpOption('-h, --help', '查看帮助信息')
  .option('-t, --target <target>', '转换的目标格式', 'composition-api')
  .option('-p, --path <target>', '需要进行代码转换的目录或文件', '.');

program.parse(process.argv);

const options = program.opts();

batchConvert(options.path);
