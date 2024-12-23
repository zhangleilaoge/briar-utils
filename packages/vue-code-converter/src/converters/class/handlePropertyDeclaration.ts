import {
  Decorator,
  PropertyAssignment,
  ScriptTarget,
  SourceFile,
  createSourceFile,
  factory,
  isCallExpression,
  isExpressionStatement,
  isObjectLiteralExpression,
  isStringLiteral,
} from "typescript"
import { tsTypeToVuePropType } from "../../utils/type"
import { uniqWith } from "lodash-es"

const getDecoratorInfo = ({
  decorator,
  sourceFile,
  tsType,
  targetDecorator,
}: {
  decorator: Decorator
  sourceFile: SourceFile
  tsType?: string
  targetDecorator: string | string[]
}) => {
  const callExpression = decorator.expression

  if (!isCallExpression(callExpression)) return null

  const decoratorName = callExpression.expression.getText(sourceFile)

  if (![targetDecorator].flat().includes(decoratorName)) return null

  const args = callExpression.arguments || []

  const vuePropType = tsTypeToVuePropType(tsType)

  return {
    args,
    vuePropType,
    decoratorName,
  }
}

export const parsePropDecorator = ({
  decorator,
  sourceFile,
  tsType,
  targetDecorator,
  propOptionsIndex = 0,
}: {
  decorator: Decorator
  sourceFile: SourceFile
  tsType?: string
  targetDecorator?: string | string[]
  propOptionsIndex?: number
}) => {
  const decoratorInfo = getDecoratorInfo({
    decorator,
    sourceFile,
    tsType,
    targetDecorator: targetDecorator || "Prop",
  })

  if (!decoratorInfo) return null

  const { args, vuePropType } = decoratorInfo
  const propOption = args[propOptionsIndex]

  // case1: @Prop({})
  if (propOption && isObjectLiteralExpression(propOption)) {
    if (tsType == null) {
      return {
        node: propOption,
      }
    }

    const typeState = createSourceFile(
      "",
      vuePropType.expression,
      ScriptTarget.Latest
    ).statements[0]

    if (isExpressionStatement(typeState)) {
      const options = factory.createObjectLiteralExpression(
        uniqWith(
          [
            ...propOption.properties,
            factory.createPropertyAssignment("type", typeState.expression),
          ],
          // @ts-ignore
          (a, b) => a.name.text === b.name.text
        )
      )
      return {
        use: vuePropType.use,
        node: options,
      }
    }
  }

  // case2: @Prop()
  return {
    use: vuePropType.use,
    node: factory.createObjectLiteralExpression([
      factory.createPropertyAssignment(
        "type",
        factory.createIdentifier(vuePropType.expression)
      ),
    ]),
  }
}

export const parseInjectDecorator = (
  decorator: Decorator,
  sourceFile: SourceFile,
  tsType?: string
) => {
  const decoratorInfo = getDecoratorInfo({
    decorator,
    sourceFile,
    tsType,
    targetDecorator: ["Inject", "InjectReactive"],
  })

  if (!decoratorInfo) return null

  const { args } = decoratorInfo

  // case1: @Inject()
  if (!args[0]) {
    return {
      type: tsType,
    }
  }

  // case2: @Inject('a')
  if (isStringLiteral(args[0])) {
    return {
      from: args[0].getText(sourceFile),
      type: tsType,
    }
  }

  // case3: @Inject({from: 'a', default: 'b'})
  if (isObjectLiteralExpression(args[0])) {
    let _from = ""
    let _default = ""
    // @ts-ignore
    for (const prop of args[0].properties) {
      if (prop.name?.getText(sourceFile) === "from") {
        _from = (prop as PropertyAssignment).initializer.getText(sourceFile)
      }
      if (prop.name?.getText(sourceFile) === "default") {
        _default = (prop as PropertyAssignment).initializer.getText(sourceFile)
      }
    }

    return {
      from: _from,
      default: _default,
      type: tsType,
    }
  }

  return null
}

export const parseProvideDecorator = (
  decorator: Decorator,
  sourceFile: SourceFile,
  tsType?: string
) => {
  const decoratorInfo = getDecoratorInfo({
    decorator,
    sourceFile,
    tsType,
    targetDecorator: ["Provide", "ProvideReactive"],
  })

  if (!decoratorInfo) return null

  const { args } = decoratorInfo

  // case1: @Provide()
  if (!args[0]) {
    return {
      type: tsType,
    }
  }

  // case2: @Provide('a')
  if (isStringLiteral(args[0])) {
    return {
      from: args[0].getText(sourceFile),
      type: tsType,
    }
  }

  return null
}

export const parseModelDecorator = (
  decorator: Decorator,
  sourceFile: SourceFile,
  tsType?: string
) => {
  const decoratorInfo = getDecoratorInfo({
    decorator,
    sourceFile,
    tsType,
    targetDecorator: ["Model", "ModelSync"],
  })

  if (!decoratorInfo) return null

  const { args, decoratorName } = decoratorInfo
  const propNameIndex = decoratorName === "ModelSync" ? 0 : -1
  const eventIndex = propNameIndex + 1
  const propOptionsIndex = eventIndex + 1

  const result = {
    propNode: parsePropDecorator({
      decorator,
      sourceFile,
      tsType,
      targetDecorator: ["Model", "ModelSync"],
      propOptionsIndex,
    }),
    modelNode: {
      event: args[eventIndex].getText(sourceFile),
      prop: args?.[propNameIndex]?.getText(sourceFile),
    },
  }

  return result
}
