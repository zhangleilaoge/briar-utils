import { SourceFile, Node } from "typescript"
import { ConvertedExpression, getMethodExpression } from "../../helper"

export const lifecycleConverter = (
  node: Node,
  sourceFile: SourceFile
): ConvertedExpression[] => {
  return getMethodExpression({ node, sourceFile })
}
