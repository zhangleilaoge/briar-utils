import {
  SourceFile,
  Node,
  ArrayLiteralExpression,
  ObjectLiteralExpression,
  PropertyAssignment,
  SyntaxKind,
  isObjectLiteralExpression,
  isStringLiteral,
} from "typescript"
import { ConvertedExpression } from "../../helper"
import { useEnum } from "../../type"
import { getNodeByKind } from "../../utils/ast"

export const injectConverter = (
  node: Node,
  sourceFile: SourceFile
): ConvertedExpression[] => {
  const arrNode = getNodeByKind(
    node,
    SyntaxKind.ArrayLiteralExpression
  ) as ArrayLiteralExpression

  // case1: ['a', 'b']
  if (arrNode) {
    return arrNode.elements.map((el) => {
      const elName = el.getText(sourceFile).replace(/['"]+/g, "")
      return {
        use: useEnum.Inject,
        expression: `const ${elName} = inject('${elName}');`,
        returnNames: [elName],
      }
    })
  }

  const objNode = getNodeByKind(
    node,
    SyntaxKind.ObjectLiteralExpression
  ) as ObjectLiteralExpression

  if (objNode) {
    return objNode.properties
      .map((injectItem) => {
        const _injectItem = injectItem as PropertyAssignment
        const injectName = _injectItem.name.getText(sourceFile)

        // case2: {a: 'a'}
        if (isStringLiteral(_injectItem.initializer)) {
          const injectFrom = _injectItem.initializer.getText(sourceFile)

          return {
            use: useEnum.Inject,
            expression: `const ${injectName} = inject(${injectFrom});`,
            returnNames: [injectName],
          }
        }

        // case3: {a: {from: 'a', default: 'b'}}
        if (isObjectLiteralExpression(_injectItem.initializer)) {
          let _from = ""
          let _default = ""
          for (const injectItemProp of _injectItem.initializer.properties) {
            if (injectItemProp.name?.getText(sourceFile) === "from") {
              _from = (
                injectItemProp as PropertyAssignment
              ).initializer.getText(sourceFile)
            }
            if (injectItemProp.name?.getText(sourceFile) === "default") {
              _default = (
                injectItemProp as PropertyAssignment
              ).initializer.getText(sourceFile)
            }
          }

          return {
            use: useEnum.Inject,
            expression: `const ${injectName} = inject(${_from})${
              _default ? ` || (${_default})` : ""
            };`,
            returnNames: [injectName],
          }
        }
        return null
      })
      .filter(Boolean) as ConvertedExpression[]
  }

  return []
}
