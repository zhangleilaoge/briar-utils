import {
  SourceFile,
  Node,
  SyntaxKind,
  ObjectLiteralExpression,
  PropertyAssignment,
} from "typescript"
import { ConvertedExpression } from "../../helper"
import { useEnum } from "../../type"
import { getNodeByKind } from "../../utils/ast"

export const providerConverter = (
  node: Node,
  sourceFile: SourceFile
): ConvertedExpression[] => {
  const objNode = getNodeByKind(
    node,
    SyntaxKind.ObjectLiteralExpression
  ) as ObjectLiteralExpression

  if (objNode) {
    return objNode.properties.map((prop) => {
      const _prop = prop as PropertyAssignment
      const provideName = _prop.name.getText(sourceFile)
      return {
        use: useEnum.Provide,
        expression: `provide('${provideName}', ${_prop.initializer.getText(
          sourceFile
        )})`,
      }
    })
  }

  return []
}
