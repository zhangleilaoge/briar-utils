import {
  Block,
  ScriptTarget,
  Node,
  SourceFile,
  SyntaxKind,
  createSourceFile,
  forEachChild,
} from "typescript"
import { ConvertedExpression } from "../helper"

export const getNodeBy = (
  node: Node,
  compare: (_: Node) => boolean
): Node | undefined => {
  const find = (node: Node): Node | undefined => {
    return forEachChild(node, (child) => {
      if (compare(child)) {
        return child
      }
      return find(child)
    })
  }
  return find(node)
}

export const getNodeByKind = <T extends Node>(node: Node, kind: SyntaxKind) => {
  const find = (node: Node): Node | undefined => {
    return forEachChild(node, (child) => {
      if (child.kind === kind) {
        return child
      }
      return find(child)
    })
  }
  return find(node) as T | undefined
}

export const getFunctionStatements = (
  node: Node,
  sourceFile: SourceFile,
  exclude: SyntaxKind[] = [SyntaxKind.ReturnStatement]
): ConvertedExpression[] => {
  const block = getNodeByKind(node, SyntaxKind.Block) as Block

  if (!block) return []

  return [...block.statements]
    .filter((statement) => {
      return !exclude.includes(statement.kind)
    })
    .map((state) => ({
      expression: state.getText(sourceFile),
    }))
}

export const mergeBlockBody = (
  body1 = "{}",
  body2 = "{}",
  exclude?: RegExp
) => {
  // 解析代码块为 AST
  const sourceFile1 = createSourceFile(
    "body1.ts",
    body1,
    ScriptTarget.Latest,
    true
  )
  const sourceFile2 = createSourceFile(
    "body2.ts",
    body2,
    ScriptTarget.Latest,
    true
  )

  // 提取代码块中的语句
  const statements1 = (sourceFile1.statements[0] as Block).statements
    .map((statement) => statement.getText(sourceFile1))
    .filter((statement) => (exclude ? !exclude.test(statement) : true))
  const statements2 = (sourceFile2.statements[0] as Block).statements
    .map((statement) => statement.getText(sourceFile2))
    .filter((statement) => (exclude ? !exclude.test(statement) : true))

  // 合并语句并去重
  const statementSet = new Set<string>([...statements1, ...statements2])

  return `{${Array.from(statementSet).join(" ")}}`
}
