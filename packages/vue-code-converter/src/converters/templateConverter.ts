import { compileTemplate } from '@vue/compiler-sfc';
import { TemplateChildNode, RootNode } from '@vue/compiler-core';

/** @description 对 template 模版进行转化, 暂时无用，后续有对模版进行替换的需求时再扩展 */
export const convertTemplate = (input: string) => {
  const templateVariables: Set<string> = new Set();

  const result = compileTemplate({
    source: input,
    filename: '',
    id: '',
  });

  const transformer = (node: TemplateChildNode | RootNode) => {
    // @ts-ignore 1. 处理模版属性上的响应式变量
    node?.props?.forEach((item) => {
      if (['on', 'bind', 'model'].includes(item?.name) && item?.exp) {
        const variable = item?.exp?.loc?.source?.trim();
        if (variable) {
          templateVariables.add(variable);
        }
      }
    });

    // @ts-ignore 2. 处理模版中的响应式变量
    node?.content?.children?.forEach((item) => {
      const variable = item?.loc?.source?.trim();
      if (variable) {
        templateVariables.add(variable);
      }
    });
    if (
      // @ts-ignore
      !node?.content?.children?.length &&
      // @ts-ignore
      !node?.children?.length &&
      node.loc?.source?.trim()
    ) {
      templateVariables.add(node.loc?.source?.trim());
    }

    // @ts-ignore
    node?.children?.forEach(transformer);
  };

  transformer(result.ast!);

  return {
    output: input,
    /** 模版用到的所有变量 */
    templateVariables: Array.from(templateVariables),
  };
};
