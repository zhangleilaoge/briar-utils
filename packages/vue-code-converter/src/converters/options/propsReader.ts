import {
  SourceFile,
  createPrinter,
  isPropertyAssignment,
  isObjectLiteralExpression,
  isArrayLiteralExpression,
  isStringLiteral,
  Node,
} from "typescript"

/** @description 过滤掉未在 setup 中使用的 props */
export const filterUsedProps = (
  propNames: string[],
  sourceFile: SourceFile
) => {
  const printer = createPrinter()
  const content = printer.printFile(sourceFile)

  return propNames.filter((propName) => {
    const regex = new RegExp(`\\b${propName}\\b`, "g")
    const matches = content.match(regex)

    return (matches?.length || 0) > 1
  })
}

export const propReader = (node: Node, sourceFile: SourceFile): string[] => {
  if (!isPropertyAssignment(node)) return []

  if (isObjectLiteralExpression(node.initializer)) {
    return filterUsedProps(
      node.initializer.properties
        .map((prop) => {
          if (!isPropertyAssignment(prop)) return null
          return prop.name.getText(sourceFile)
        })
        .filter(Boolean) as string[],
      sourceFile
    )
  }
  if (isArrayLiteralExpression(node.initializer)) {
    return filterUsedProps(
      node.initializer.elements
        .map((el) => {
          if (isStringLiteral(el)) return el.text
          return null
        })
        .filter(Boolean) as string[],
      sourceFile
    )
  }
  return []
}
