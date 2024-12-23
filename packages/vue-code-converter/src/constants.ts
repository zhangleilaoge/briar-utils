import { IVuexParams, IncompatibleSyntax } from './type';
import parserHtml from 'prettier/parser-html';
import { Options } from 'prettier';
import parserBabel from 'prettier/parser-babel';
import parserPostCss from 'prettier/parser-postcss';
import parserTypeScript from 'prettier/parser-typescript';

export const DEFAULT_VUEX_PARAMS: Omit<IVuexParams, 'moduleName'> = {
  mapState: 'mapState',
  mapActions: 'mapActions',
  mapGetters: 'mapGetters',
  mapMutations: 'mapMutations',
};

export const INCOMPATIBLE_SYNTAX_PLACEHOLDERS = {
  [IncompatibleSyntax.Mixins]: 'DontUseMixinsAnyMore',
  [IncompatibleSyntax.Extends]: 'DontUseExtendsAnyMore',
  [IncompatibleSyntax.VuexModuleDecorators]: `don't use vuex-module-decorators any more`,
  [IncompatibleSyntax.VuexClass]: `don't use vuex-class any more`,
  [IncompatibleSyntax.SameName]: 'DontUseSameName',
};

export const DEFAULT_PRETTIER_OPTIONS: Options = {
  parser: 'vue',
  plugins: [parserHtml, parserBabel, parserPostCss, parserTypeScript],
  singleQuote: true,
  semi: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  vueIndentScriptAndStyle: false,
  trailingComma: 'all',
};
