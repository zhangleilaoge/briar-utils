import { SFCBlock } from "vue-template-compiler"
import ConvertClassService from "./converters/classApiConvertService"
import { convertOptionsApi } from "./converters/optionsApiConverter"
import { getNodeByKind } from "./utils/ast"
import { IConvertOptions, IConvertResult, InputType } from "./type"
import {
  handleIncompatibleSyntax,
  handleSameNameVar,
} from "./converters/safeConverter"
import prettier, { Options } from "prettier"
import { DEFAULT_PRETTIER_OPTIONS } from "./constants"
import {
  ClassDeclaration,
  ScriptTarget,
  SyntaxKind,
  createSourceFile,
} from "typescript"
import {
  getFileCode,
  getGlobalScript,
  initFileCode,
  setGlobalScript,
} from "./store"

const checkNeedConvert = (input: string) => {
  if (input.includes("composition-api") && input.includes("setup")) {
    return false
  }

  return true
}

export const convertSrc = (input: string): IConvertResult => {
  if (!checkNeedConvert(input)) {
    return {
      inputType: InputType.CompositionApi,
    }
  }

  initFileCode(input)

  const sourceFile = createSourceFile(
    "",
    getGlobalScript()?.content || "",
    ScriptTarget.Latest
  )

  // optionsAPI
  const exportAssignNode = getNodeByKind(
    sourceFile,
    SyntaxKind.ExportAssignment
  )
  if (exportAssignNode) {
    setGlobalScript({
      content: convertOptionsApi(sourceFile),
    } as SFCBlock)

    return {
      inputType: InputType.OptionStyle,
    }
  }

  // classAPI
  const classNode = getNodeByKind<ClassDeclaration>(
    sourceFile,
    SyntaxKind.ClassDeclaration
  )
  if (classNode) {
    setGlobalScript({
      content: new ConvertClassService(classNode, sourceFile).convertClass(),
    } as SFCBlock)

    return {
      inputType: InputType.DecorateStyle,
    }
  }

  throw new Error("no convert target.")
}

export const safeConvert = (result: IConvertResult): IConvertResult => {
  const { inputType } = result
  const scriptContent = getGlobalScript()?.content || ""

  // 处理不兼容的语法
  const { warning, output: handledIncompatibleSyntaxScript } =
    handleIncompatibleSyntax(scriptContent)

  // 处理重名变量
  const { output: handledSameNameScript, warning: handledSameNameWarning } =
    handleSameNameVar(handledIncompatibleSyntaxScript, warning)

  setGlobalScript({
    content: handledSameNameScript,
  } as SFCBlock)

  return {
    inputType,
    warning: handledSameNameWarning,
  }
}

export const prettierConvert = (
  result: IConvertResult,
  prettierOptions: Partial<Options> = DEFAULT_PRETTIER_OPTIONS
): IConvertResult => {
  const output = getFileCode()

  const formattedOutput = prettier.format(output, {
    ...DEFAULT_PRETTIER_OPTIONS,
    ...prettierOptions,
  })

  initFileCode(formattedOutput)

  return {
    ...result,
  }
}

export const convert = (
  input: string,
  option?: IConvertOptions
): IConvertResult & { output: string } => {
  let result = convertSrc(input)

  if (option?.strict && result.inputType !== InputType.CompositionApi) {
    result = safeConvert(result)
  }

  if (result.inputType !== InputType.CompositionApi) {
    result = prettierConvert(result, option?.prettier)
  }

  return { ...result, output: getFileCode() || input }
}
