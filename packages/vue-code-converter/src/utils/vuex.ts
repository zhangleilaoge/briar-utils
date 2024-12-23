import { IVuexParams } from "../type"
import { DEFAULT_VUEX_PARAMS } from "../constants"
import { getNodeBy } from "./ast"
import {
  SourceFile,
  isVariableDeclaration,
  Node,
  isObjectBindingPattern,
  isCallExpression,
  isIdentifier,
  Identifier,
} from "typescript"

export const handleVuex = (sourceFile: SourceFile): IVuexParams => {
  let moduleName = ""
  const bindingNames: Record<string, string> = {
    ...DEFAULT_VUEX_PARAMS,
  }

  getNodeBy(sourceFile, (node: Node) => {
    if (isVariableDeclaration(node)) {
      const callExpression = node.initializer!
      if (
        isObjectBindingPattern(node.name) &&
        isCallExpression(callExpression)
      ) {
        if (
          isIdentifier(callExpression.expression) &&
          callExpression.expression.getText(sourceFile) ===
            "createNamespacedHelpers"
        ) {
          moduleName = callExpression.arguments[0].getText(sourceFile)
          node.name.elements.forEach((element) => {
            bindingNames[
              (element.propertyName || element.name).getText(sourceFile)
            ] = (element.name as Identifier).getText(sourceFile)
          })
          return true
        }
      }
    }
    return false
  })

  return {
    ...DEFAULT_VUEX_PARAMS,
    ...bindingNames,
    moduleName,
  }
}
