import {
  ConvertedExpression,
  getInitializerProps,
  getMethodExpression,
} from "../../helper"
import { DEFAULT_VUEX_PARAMS } from "../../constants"
import { IVuexParams } from "../../type"
import { SourceFile, Node } from "typescript"

export const methodsConverter = ({
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
      return getMethodExpression({ node: prop, sourceFile, vuexParams })
    })
    .flat()
}
