import { IVuexParams, Vue2LifecycleEnum, useEnum } from "./type"
import { DEFAULT_VUEX_PARAMS } from "./constants"
import { getInsertString, replaceVariableInCode } from "./utils/string"
import {
  ScriptTarget,
  SourceFile,
  TransformationContext,
  VisitResult,
  createSourceFile,
  Node,
  isVariableStatement,
  isVariableDeclaration,
  isObjectBindingPattern,
  isBindingElement,
  isIdentifier,
  createVariableStatement,
  NodeArray,
  NodeFlags,
  ObjectLiteralElementLike,
  StringLiteral,
  SyntaxKind,
  createIdentifier,
  createPrinter,
  createPropertyAccess,
  createThis,
  createVariableDeclaration,
  createVariableDeclarationList,
  factory,
  isArrayLiteralExpression,
  isCallExpression,
  isMethodDeclaration,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isSpreadAssignment,
  isStringLiteral,
  transform,
  visitEachChild,
  visitNode,
} from "typescript"
import { getGlobalTemplate, setGlobalTemplate } from "./store"

export interface ConvertedExpression {
  expression: string
  returnNames?: string[]
  use?: useEnum
}

export const lifecycleNameMap: Map<Vue2LifecycleEnum, useEnum | undefined> =
  new Map([
    [Vue2LifecycleEnum.BeforeCreate, undefined],
    [Vue2LifecycleEnum.Created, undefined],
    [Vue2LifecycleEnum.BeforeMount, useEnum.OnBeforeMount],
    [Vue2LifecycleEnum.Mounted, useEnum.OnMounted],
    [Vue2LifecycleEnum.BeforeUpdate, useEnum.OnBeforeUpdate],
    [Vue2LifecycleEnum.Updated, useEnum.OnUpdated],
    [Vue2LifecycleEnum.BeforeUnmount, useEnum.OnBeforeUnmount],
    [Vue2LifecycleEnum.BeforeDestroy, useEnum.OnBeforeUnmount],
    [Vue2LifecycleEnum.Destroyed, useEnum.OnUnmounted],
    [Vue2LifecycleEnum.ErrorCaptured, useEnum.OnErrorCaptured],
    [Vue2LifecycleEnum.RenderTracked, useEnum.OnRenderTracked],
    [Vue2LifecycleEnum.RenderTriggered, useEnum.OnRenderTriggered],
    [Vue2LifecycleEnum.Activated, useEnum.OnActivated],
    [Vue2LifecycleEnum.Deactivated, useEnum.OnDeactivated],
  ])

const contextProps = [
  "attrs",
  "slots",
  "parent",
  "root",
  "listeners",
  "refs",
  "emit",
]

export const getToRefsExpression = (returnNames: string[]) => {
  return `const { ${returnNames.join(",")} } = toRefs(props)`
}

/** @description 将永不修改的 ref 变量降级，调整为普通变量或直接使用原始值 */
const downgradeRefToNormal = (
  setupProps: ConvertedExpression[],
  sourceCode: string
) => {
  const downgradeRefs: string[] = []
  const removeRefs: {
    refName: string
    initialValueName: string
  }[] = []

  // 1. 收集所有永不被修改的 ref 变量定义，并替换为普通变量声明，或直接删除当前变量声明
  setupProps = setupProps.map((item) => {
    const { use, returnNames, expression } = item
    const isNeverChange =
      returnNames?.length === 1 &&
      /^(ref)$/.test(use || "") &&
      !sourceCode.match(new RegExp(`this\\.${returnNames[0]}\\s*=`, "g"))
        ?.length &&
      !getGlobalTemplate()?.content.match(
        new RegExp(`v-model(:[-\\w]+)?(\\.\\w+)?="${returnNames[0]}"`, "g")
      )?.length

    if (isNeverChange) {
      const initialValueName = expression.match(
        /ref\(\s*([a-zA-Z_$][\w$]*)\s*\)/
      )?.[1]

      if (initialValueName) {
        removeRefs.push({
          refName: returnNames[0],
          initialValueName,
        })
        return {
          use: undefined,
          returnNames: [initialValueName],
          expression: "",
        }
      } else {
        downgradeRefs.push(returnNames[0])
        return {
          ...item,
          use: undefined,
          expression: expression.replace(/ref\((.+)\)/, "$1"),
        }
      }
    }

    return item
  })

  // 2. 将 script 部分中对永不修改的原 ref 的引用调整为普通变量引用，或调整为原始值引用
  setupProps = setupProps.map((item) => {
    const { expression } = item

    for (let i = 0; i < downgradeRefs?.length; i++) {
      const refName = downgradeRefs[i]
      if (expression.includes(`this.${refName}`)) {
        return {
          ...item,
          expression: expression.replace(
            new RegExp(`this\\.(${refName})`, "g"),
            `$1`
          ),
        }
      }
    }

    for (let i = 0; i < removeRefs?.length; i++) {
      const { refName, initialValueName } = removeRefs[i]
      if (expression.includes(`this.${refName}`)) {
        return {
          ...item,
          expression: replaceVariableInCode(
            expression,
            `this.${refName}`,
            initialValueName
          ),
        }
      }
    }
    return item
  })
  for (let i = 0; i < removeRefs?.length; i++) {
    const { refName, initialValueName } = removeRefs[i]
    const template = getGlobalTemplate()
      ?.content?.replace(
        new RegExp(`="\\s*([^}]*)\\b${refName}\\b([^}]*)\\s*"`, "g"),
        `="$1${initialValueName}$2"`
      )
      .replace(
        new RegExp(`{{\\s*([^}]*)\\b${refName}\\b([^}]*)\\s*}}`, "g"),
        `{{ $1${initialValueName}$2 }}`
      )

    setGlobalTemplate({
      ...getGlobalTemplate(),
      content: template,
    })
  }

  return setupProps
}

/**
 * @description 将从 this 解构对象中的属性拆分出来
 * @example { a, b } = this => const a = this.a; const b = this.b
 */
const transformDestructFromThis = (source: string) => {
  const sourceFile = createSourceFile("", source, ScriptTarget.Latest)

  function transformer(context: TransformationContext) {
    return (rootNode: SourceFile) => {
      function visit(node: Node): VisitResult<Node> {
        if (isVariableStatement(node)) {
          const { declarations } = node.declarationList
          for (const declaration of declarations) {
            if (
              isVariableDeclaration(declaration) &&
              isObjectBindingPattern(declaration.name) &&
              declaration?.initializer?.getText(sourceFile) === "this"
            ) {
              const { elements } = declaration.name
              const statements = elements.map((element) => {
                if (isBindingElement(element) && isIdentifier(element.name)) {
                  const name = element.name.text
                  return createVariableStatement(
                    undefined,
                    createVariableDeclarationList(
                      [
                        createVariableDeclaration(
                          createIdentifier(name),
                          undefined,
                          createPropertyAccess(
                            createThis(),
                            createIdentifier(name)
                          )
                        ),
                      ],
                      NodeFlags.Const
                    )
                  )
                }
                return element
              })
              return statements
            }
          }
        }

        return visitEachChild(node, visit, context)
      }

      // 从根节点开始遍历
      return visitNode(rootNode, visit)
    }
  }

  const printer = createPrinter()
  const result = transform(sourceFile, [transformer])
  const transformedSourceFile = result.transformed[0]

  return printer.printFile(transformedSourceFile)
}

export const replaceThisContext = (
  str: string,
  refNameMap: Map<string, true>
) => {
  return transformDestructFromThis(str)
    .replace(/this\.\$(\w+)/g, (_, p1) => {
      if (contextProps.includes(p1)) return `ctx.${p1}`
      return `ctx.root.$${p1}`
    })
    .replace(/this\.([\w-]+)/g, (_, p1) => {
      return refNameMap.has(p1) ? `${p1}.value` : p1
    })
}

export const getSetupStatements = ({
  setupProps,
  sourceCode,
}: {
  setupProps: ConvertedExpression[]
  sourceCode: string
}) => {
  // this.prop => prop.value
  const refNameMap: Map<string, true> = new Map()
  const toRefsNames: string[] = []

  const templateContent = getGlobalTemplate()?.content || ""

  setupProps.forEach(({ use, returnNames }) => {
    if (
      returnNames != null &&
      use != null &&
      /^(toRefs|ref|computed)$/.test(use)
    ) {
      returnNames.forEach((returnName) => {
        refNameMap.set(returnName, true)
      })
    }
  })

  // 1. 避免存在无用的响应式变量：如果存在 template，且响应式变量仅定义没有被其他任何地方所消费，则直接删掉
  setupProps = setupProps.filter(({ use, returnNames }) => {
    const isUnused =
      returnNames?.length === 1 &&
      /^(ref|computed)$/.test(use || "") &&
      templateContent &&
      !templateContent.match(new RegExp(`\\b${returnNames[0]}\\b`, "g")) &&
      sourceCode.match(new RegExp(`\\b${returnNames[0]}\\b`, "g"))?.length === 1

    return !isUnused
  })

  // 2. 将无用的 toRefs 变量在 setup 中删去。20240829：去掉这段代码，因为没法判断是否无用。就像@ModelSync，看似没有this.xx被消费，实际转换后就有了
  // setupProps = setupProps
  //   .map((item) => {
  //     const { use, returnNames = [] } = item
  //     if (use === useEnum.ToRefs) {
  //       const usedToRefsVars = returnNames?.filter((returnName) => {
  //         return !!getGlobalScript()?.content.match(
  //           new RegExp(`\\b${returnName}\\b`, "g")
  //         )?.length
  //       })
  //       return {
  //         ...item,
  //         returnNames: usedToRefsVars,
  //         expression: getToRefsExpression(usedToRefsVars),
  //       }
  //     }
  //     return item
  //   })
  //   .filter(({ use, returnNames }) => {
  //     if (use === useEnum.ToRefs && returnNames) {
  //       if (returnNames?.length === 0) {
  //         return false
  //       }
  //       toRefsNames.push(...returnNames)
  //     }

  //     return true
  //   })

  // 3. 将永不修改的 ref 变量降级：调整为普通变量或直接使用原始值
  setupProps = downgradeRefToNormal(setupProps, sourceCode)

  // 4. 避免无效的 return：如果存在 template，则只返回 template 有消费的变量
  const returnPropsStatement = `return {${setupProps
    .filter((prop) => prop.use !== useEnum.ToRefs) // ignore spread props
    .map(({ returnNames }) => returnNames)
    .filter(Boolean)
    .flat()
    .filter((returnValue) => {
      // 此时 template 可能已经被改动，这里冲获取一次
      const templateContent = getGlobalTemplate()?.content || ""
      if (templateContent) {
        return templateContent.match(new RegExp(`\\b${returnValue}\\b`))
      }

      return true
    })
    .join(",")}}`

  const statementsExpressions = [
    ...setupProps,
    { expression: returnPropsStatement },
  ]
    .filter(({ expression }) => expression)
    .map(({ expression }) => {
      return {
        // 4. 将 this.xx 写法进行转换
        expression: replaceThisContext(expression, refNameMap),
      }
    })

  const statements = statementsExpressions
    .map(
      ({ expression }) =>
        createSourceFile("", expression, ScriptTarget.Latest).statements
    )
    .flat()

  return {
    statements,
    statementsExpressions,
    toRefsNames,
  }
}

export const getInitializerProps = (node: Node): ObjectLiteralElementLike[] => {
  if (!isPropertyAssignment(node)) return []
  if (!isObjectLiteralExpression(node.initializer)) return []
  return [...node.initializer.properties]
}

export const storePath = `this.$store`

export const getMethodExpression = ({
  node,
  sourceFile,
  vuexParams = DEFAULT_VUEX_PARAMS,
}: {
  node: Node
  sourceFile: SourceFile
  vuexParams?: IVuexParams
}): ConvertedExpression[] => {
  if (isMethodDeclaration(node)) {
    const async = node.modifiers?.some(
      (mod) => mod.kind === SyntaxKind.AsyncKeyword
    )
      ? "async"
      : ""

    const name = node.name.getText(sourceFile)
    const type = node.type ? `:${node.type.getText(sourceFile)}` : ""
    const body = node.body?.getText(sourceFile) || "{}"
    const parameters = node.parameters
      .map((param) => param.getText(sourceFile))
      .join(",")
    const fn = `${async}(${parameters})${type} =>${body}`

    if (lifecycleNameMap.has(name as Vue2LifecycleEnum)) {
      const newLifecycleName = lifecycleNameMap.get(name as Vue2LifecycleEnum)
      const immediate = newLifecycleName == null ? "()" : ""
      return [
        {
          use: newLifecycleName,
          expression: `${newLifecycleName ?? ""}(${fn})${immediate}`,
        },
      ]
    }
    return [
      {
        returnNames: [name],
        expression: `const ${name} = ${fn}`,
      },
    ]
  }
  if (isSpreadAssignment(node)) {
    // mapActions, mapMutations
    if (!isCallExpression(node.expression)) return []
    const { arguments: args, expression } = node.expression

    if (!isIdentifier(expression)) return []
    const mapName = expression.text
    let [namespace, mapArray] = args
    // 处理 createNamespacedHelpers 场景
    if (vuexParams.moduleName) {
      mapArray = namespace
      namespace = factory.createStringLiteral(vuexParams.moduleName)
    }

    if (!isStringLiteral(namespace) || !isArrayLiteralExpression(mapArray))
      return []

    const namespaceText = namespace.getText(sourceFile) || namespace.text
    const names = mapArray.elements as NodeArray<StringLiteral>

    if (mapName === vuexParams.mapActions) {
      return names.map(({ text: name }) => {
        return {
          expression: `const ${name} = () => ${storePath}.dispatch(\`${getInsertString(
            namespaceText
          )}/${name}\`)`,
          returnNames: [name],
        }
      })
    }
    if (mapName === vuexParams.mapMutations) {
      return names.map(({ text: name }) => {
        return {
          expression: `const ${name} = () => ${storePath}.commit(\`${getInsertString(
            namespaceText
          )}/${name}\`)`,
          returnNames: [name],
        }
      })
    }
  }
  return []
}

export const getImportStatement = (setupProps: ConvertedExpression[]) => {
  const usedFunctions = [
    "defineComponent",
    ...new Set(setupProps.map(({ use }) => use).filter(Boolean)),
  ]
  return createSourceFile(
    "",
    `import { ${usedFunctions.join(",")} } from '@vue/composition-api'`,
    ScriptTarget.Latest
  ).statements
}

export const getExportStatement = ({
  setupProps,
  otherProps,
  sourceCode,
}: {
  setupProps: ConvertedExpression[]
  otherProps: ObjectLiteralElementLike[]
  sourceCode: string
}) => {
  const {
    statements: setupStatements,
    statementsExpressions,
    toRefsNames,
  } = getSetupStatements({ setupProps, sourceCode })
  const propsArg = [
    toRefsNames.length === 0 ? "_props" : `props`,
    statementsExpressions.some((express) => express.expression.includes("ctx."))
      ? "ctx"
      : "_ctx",
  ]
  // 去掉多余的 props
  while (propsArg.length > 0 && propsArg[propsArg.length - 1].startsWith("_")) {
    propsArg.pop()
  }

  const setupArgs = propsArg.map((name) =>
    factory.createParameterDeclaration(undefined, undefined, undefined, name)
  )

  const setupMethod = factory.createMethodDeclaration(
    undefined,
    undefined,
    undefined,
    "setup",
    undefined,
    undefined,
    setupArgs,
    undefined,
    factory.createBlock(setupStatements)
  )

  return factory.createExportAssignment(
    undefined,
    undefined,
    undefined,
    factory.createCallExpression(
      factory.createIdentifier("defineComponent"),
      undefined,
      [factory.createObjectLiteralExpression([...otherProps, setupMethod])]
    )
  )
}
