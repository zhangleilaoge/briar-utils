import {
  SourceFile,
  Node,
  ObjectLiteralElementLike,
  SyntaxKind,
  isMethodDeclaration,
  isObjectLiteralExpression,
  isPropertyAssignment,
} from "typescript"
import { ConvertedExpression, getInitializerProps } from "../../helper"
import { useEnum } from "../../type"

export const normalizeWatchName = (name: string) => {
  if (name[0] === "'" || name[0] === '"') {
    name = name.replace(/['"]/g, "")
  }
  if (name.startsWith("$")) {
    return "ctx.root." + name
  }
  return name
}

export const watchConverter = (
  node: Node,
  sourceFile: SourceFile
): ConvertedExpression[] => {
  return getInitializerProps(node)
    .map((prop) => {
      if (isMethodDeclaration(prop)) {
        const name = prop.name.getText(sourceFile)
        const parameters = prop.parameters
          .map((param) => param.getText(sourceFile))
          .join(",")
        const block = prop.body?.getText(sourceFile) || "{}"

        return {
          use: useEnum.Watch,
          expression: `watch(() => ${normalizeWatchName(
            name
          )}, (${parameters}) => ${block})`,
        }
      }
      if (isPropertyAssignment(prop)) {
        if (!isObjectLiteralExpression(prop.initializer)) return

        const props = prop.initializer.properties.reduce(
          (acc: Record<string, ObjectLiteralElementLike>, prop) => {
            const name = prop.name?.getText(sourceFile)
            if (name) acc[name] = prop
            return acc
          },
          {}
        )

        const { handler, immediate, deep } = props
        if (!(handler && isMethodDeclaration(handler))) return

        const options = [immediate, deep].reduce(
          (acc: Record<string, any>, prop) => {
            if (prop && isPropertyAssignment(prop)) {
              const name = prop.name?.getText(sourceFile)
              if (name) {
                acc[name] = prop.initializer.kind === SyntaxKind.TrueKeyword
              }
            }
            return acc
          },
          {}
        )

        const name = prop.name.getText(sourceFile)
        const parameters = handler.parameters
          .map((param) => param.getText(sourceFile))
          .join(",")
        const block = handler.body?.getText(sourceFile) || "{}"

        return {
          use: useEnum.Watch,
          expression: `watch(() => ${normalizeWatchName(
            name
          )}, (${parameters}) => ${block}, ${JSON.stringify(options)} )`,
        }
      }

      return null
    })
    .filter(Boolean) as ConvertedExpression[]
}
