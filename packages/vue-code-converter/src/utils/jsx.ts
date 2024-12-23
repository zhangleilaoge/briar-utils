import {
  createPrinter,
  createJsxOpeningElement,
  factory,
  createLiteral,
  EmitHint,
  createSourceFile,
  ScriptTarget,
} from "typescript"
import { unicodeToChinese } from "./unicode"
import { SFCBlock } from "vue-template-compiler"

export function wrapWithTag(
  code: string,
  tagName: string,
  attrs: Record<string, any> = {}
): string {
  const printer = createPrinter()

  const jsxOpeningElement = createJsxOpeningElement(
    factory.createIdentifier(tagName),
    [],
    factory.createJsxAttributes([
      ...Object.entries(attrs).map(([key, value]) => {
        return factory.createJsxAttribute(
          factory.createIdentifier(key),
          value && value !== "true" && value !== true
            ? createLiteral(value)
            : undefined
        )
      }),
    ])
  )
  const openingElementText = printer.printNode(
    EmitHint.Unspecified,
    jsxOpeningElement,
    createSourceFile("", "", ScriptTarget.Latest)
  )

  const jsxClosingElement = factory.createJsxClosingElement(
    factory.createIdentifier(tagName)
  )

  const closingElementText = printer.printNode(
    EmitHint.Unspecified,
    jsxClosingElement,
    createSourceFile("", "", ScriptTarget.Latest)
  )

  return openingElementText + code + closingElementText
}

export function getCompleteContent(
  template?: SFCBlock,
  script?: SFCBlock,
  styles?: SFCBlock[]
): string {
  const templateStr = template?.content
    ? wrapWithTag(template?.content, "template", {
        ...template?.attrs,
      })
    : ""
  const scriptStr = script?.content
    ? wrapWithTag(unicodeToChinese(script?.content), "script", {
        ...script?.attrs,
        lang: "ts",
      })
    : ""
  let styleStr = ""
  styles?.forEach((item) => {
    styleStr += item?.content
      ? wrapWithTag(item?.content, "style", { ...item?.attrs })
      : ""
  })
  return `${templateStr}${scriptStr}${styleStr}`
}
