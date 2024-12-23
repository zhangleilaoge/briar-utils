import {
  ConvertedExpression,
  getInitializerProps,
  storePath,
} from "../../helper"
import { IVuexParams, useEnum } from "../../type"
import { DEFAULT_VUEX_PARAMS } from "../../constants"
import { getInsertString } from "../../utils/string"
import {
  SourceFile,
  isSpreadAssignment,
  isCallExpression,
  isIdentifier,
  factory,
  isStringLiteral,
  isArrayLiteralExpression,
  NodeArray,
  StringLiteral,
  isMethodDeclaration,
  isPropertyAssignment,
  isObjectLiteralExpression,
  Node,
} from "typescript"

export const computedConverter = ({
  node,
  sourceFile,
  vuexParams = DEFAULT_VUEX_PARAMS,
}: {
  node: Node
  sourceFile: SourceFile
  vuexParams?: IVuexParams
}): ConvertedExpression[] => {
  return getInitializerProps(node)
    .map((prop) => {
      // mapGetters, mapState
      if (isSpreadAssignment(prop)) {
        if (!isCallExpression(prop.expression)) return
        const { arguments: args, expression } = prop.expression

        if (!isIdentifier(expression)) return
        const mapName = expression.text
        let [namespace, mapArray] = args

        // 处理 createNamespacedHelpers 场景
        if (vuexParams.moduleName) {
          mapArray = namespace
          namespace = factory.createStringLiteral(vuexParams.moduleName)
        }

        if (!isStringLiteral(namespace) || !isArrayLiteralExpression(mapArray))
          return

        const namespaceText = namespace.getText(sourceFile) || namespace.text
        const names = mapArray.elements as NodeArray<StringLiteral>

        switch (mapName) {
          case vuexParams.mapState:
            return names.map(({ text: name }) => {
              return {
                use: useEnum.Computed,
                expression: `const ${name} = computed(() => ${storePath}.state[\`${getInsertString(
                  namespaceText
                )}\`].${name})`,
                returnNames: [name],
              }
            })
          case vuexParams.mapGetters:
            return names.map(({ text: name }) => {
              return {
                use: useEnum.Computed,
                expression: `const ${name} = computed(() => ${storePath}.getters[\`${getInsertString(
                  namespaceText
                )}/${name}\`])`,
                returnNames: [name],
              }
            })
        }
        return null
      }
      if (isMethodDeclaration(prop)) {
        // computed method
        const { name: propName, body, type } = prop
        const typeName = type ? `:${type.getText(sourceFile)}` : ""
        const block = body?.getText(sourceFile) || "{}"
        const name = propName.getText(sourceFile)

        return {
          use: useEnum.Computed,
          expression: `const ${name} = computed(()${typeName} => ${block})`,
          returnNames: [name],
        }
      }
      if (isPropertyAssignment(prop)) {
        // computed getter/setter
        if (!isObjectLiteralExpression(prop.initializer)) return

        const name = prop.name.getText(sourceFile)
        const block = prop.initializer.getText(sourceFile) || "{}"

        return {
          use: useEnum.Computed,
          expression: `const ${name} = computed(${block})`,
          returnNames: [name],
        }
      }
      return null
    })
    .flat()
    .filter(Boolean) as ConvertedExpression[]
}
