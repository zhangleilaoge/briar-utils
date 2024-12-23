import { IncompatibleSyntax, useEnum } from "../type"
import { INCOMPATIBLE_SYNTAX_PLACEHOLDERS } from "../constants"
import {
  createSourceFile,
  ScriptTarget,
  isImportDeclaration,
  ImportDeclaration,
  factory,
  createLiteral,
  TransformationContext,
  SourceFile,
  isCallExpression,
  isIdentifier,
  isObjectLiteralExpression,
  ObjectLiteralExpression,
  isPropertyAssignment,
  updatePropertyAssignment,
  createIdentifier,
  updateObjectLiteral,
  updateCall,
  visitEachChild,
  visitNode,
  transform,
  createPrinter,
  isMethodDeclaration,
  isBlock,
  isVariableStatement,
  isVariableDeclaration,
  isArrowFunction,
  forEachChild,
  isImportClause,
  isObjectBindingPattern,
  Node,
} from "typescript"

/** @description 处理不兼容的语法 */
export const handleIncompatibleSyntax = (scriptContent: string) => {
  const sourceFile = createSourceFile("", scriptContent, ScriptTarget.Latest)
  let warning = ""

  // handle import
  const importStatements = sourceFile.statements
    .filter((state) => isImportDeclaration(state))
    .map((_state) => {
      const state = _state as ImportDeclaration
      const importFrom = state.moduleSpecifier
        .getText(sourceFile)
        .replace(/['"]/g, "") as IncompatibleSyntax
      if (
        [
          IncompatibleSyntax.VuexModuleDecorators,
          IncompatibleSyntax.VuexClass,
        ].includes(importFrom)
      ) {
        warning += `${importFrom} is not supported in composition-api. `
        return factory.updateImportDeclaration(
          state,
          state.decorators,
          state.modifiers,
          state.importClause,
          createLiteral(INCOMPATIBLE_SYNTAX_PLACEHOLDERS[importFrom]),
          state.assertClause
        )
      }

      return state
    })

  // handle property
  const incompatibleSyntaxTransformer =
    (context: TransformationContext) => (rootNode: SourceFile) => {
      function visit(node: Node): Node {
        if (
          isCallExpression(node) &&
          isIdentifier(node.expression) &&
          node.expression.text === "defineComponent" &&
          node.arguments.length > 0 &&
          isObjectLiteralExpression(node.arguments[0])
        ) {
          const componentObject = node.arguments[0] as ObjectLiteralExpression
          const updatedProperties = componentObject.properties.map((prop) => {
            if (
              isPropertyAssignment(prop) &&
              isIdentifier(prop.name) &&
              [IncompatibleSyntax.Extends, IncompatibleSyntax.Mixins].includes(
                prop.name.text as IncompatibleSyntax
              )
            ) {
              warning += `${prop.name.text} is not supported in composition-api. `
              return updatePropertyAssignment(
                prop,
                prop.name,
                createIdentifier(
                  INCOMPATIBLE_SYNTAX_PLACEHOLDERS[
                    prop.name.text as IncompatibleSyntax
                  ]
                )
              )
            }
            return prop
          })

          const updatedComponentObject = updateObjectLiteral(
            componentObject,
            updatedProperties
          )

          return updateCall(node, node.expression, node.typeArguments, [
            updatedComponentObject,
          ])
        }
        return visitEachChild(node, visit, context)
      }
      return visitNode(rootNode, visit)
    }
  const sourceWithoutIncompatibleSyntax = transform(sourceFile, [
    incompatibleSyntaxTransformer,
  ]).transformed[0]

  const newSrc = factory.createSourceFile(
    [
      ...importStatements,
      ...sourceWithoutIncompatibleSyntax.statements.filter(
        (state) => !isImportDeclaration(state)
      ),
    ],
    sourceFile.endOfFileToken,
    sourceFile.flags
  )
  const printer = createPrinter()

  return {
    output: printer.printFile(newSrc),
    warning,
  }
}

/** @description 处理同名变量 */
export const handleSameNameVar = (scriptContent: string, warning = "") => {
  const sourceFile = createSourceFile("", scriptContent, ScriptTarget.Latest)

  const refVariables: string[] = []
  const methodNames: string[] = []

  // 获取 setup 内部所有响应式变量名和方法
  const visitToFindRefVar = (node: Node) => {
    if (
      isMethodDeclaration(node) &&
      node.name &&
      node.name.getText(sourceFile) === "setup"
    ) {
      node.forEachChild((child) => {
        if (isBlock(child)) {
          child.forEachChild((blockChild) => {
            if (isVariableStatement(blockChild)) {
              blockChild.declarationList.declarations.forEach((declaration) => {
                if (
                  isVariableDeclaration(declaration) &&
                  declaration.initializer
                ) {
                  if (
                    isCallExpression(declaration.initializer) &&
                    [useEnum.Ref, useEnum.ToRefs, useEnum.Computed].includes(
                      declaration.initializer.expression.getText(
                        sourceFile
                      ) as useEnum
                    )
                  ) {
                    refVariables.push(
                      ...declaration.name
                        .getText(sourceFile)
                        .replace(/[{}]/g, "")
                        .split(",")
                        .map((item) => item.trim())
                    )
                  } else if (isArrowFunction(declaration.initializer)) {
                    methodNames.push(declaration.name.getText(sourceFile))
                  }
                }
              })
            }
          })
        }
      })
    }
    forEachChild(node, visitToFindRefVar)
  }

  const checkNameRepeat = (nameToCheck: string) => {
    if (refVariables.includes(nameToCheck)) {
      warning += `Duplicate variable declaration found: ${nameToCheck}. `

      return true
    }
    if (methodNames.includes(nameToCheck)) {
      warning += `Duplicate method declaration found: ${nameToCheck}. `

      return true
    }

    return false
  }

  // 将与响应式变量或方法同名的其他变量声明做名称替换
  const transformer = <T extends Node>(context: TransformationContext) => {
    return (rootNode: T) => {
      function visit(node: Node): Node {
        // 1. 处理重复命名的 importName
        if (isImportClause(node)) {
          let newName
          // case1.1: import a from 'b';
          if (node.name) {
            let newNameStr

            if (checkNameRepeat(node.name.getText(sourceFile))) {
              newNameStr =
                INCOMPATIBLE_SYNTAX_PLACEHOLDERS[IncompatibleSyntax.SameName]
            } else {
              newNameStr = node.name.getText(sourceFile)
            }

            newName = newNameStr
              ? factory.createIdentifier(newNameStr)
              : undefined
          }

          let newNamedBindings
          // @ts-ignore case1.2: import { a, c as d } from 'b';
          if (node?.namedBindings?.elements) {
            newNamedBindings = factory.createNamedImports(
              // @ts-ignore
              node.namedBindings.elements?.map((ele: ExportSpecifier) => {
                const { name, propertyName } = ele
                let newName = name
                if (checkNameRepeat(name.getText(sourceFile))) {
                  newName = factory.createIdentifier(
                    INCOMPATIBLE_SYNTAX_PLACEHOLDERS[
                      IncompatibleSyntax.SameName
                    ]
                  )
                }

                return factory.createImportSpecifier(
                  false,
                  propertyName,
                  newName
                )
              }) || []
            )
            // @ts-ignore case1.3: import * as c from 'b';
          } else if (node?.namedBindings?.name) {
            newNamedBindings = factory.createNamespaceImport(
              factory.createIdentifier(
                // @ts-ignore
                checkNameRepeat(node.namedBindings.name.getText(sourceFile))
                  ? INCOMPATIBLE_SYNTAX_PLACEHOLDERS[
                      IncompatibleSyntax.SameName
                    ]
                  : // @ts-ignore
                    node.namedBindings.name.getText(sourceFile)
              )
            )
          }
          return factory.updateImportClause(
            node,
            false,
            newName,
            newNamedBindings
          )
        }

        // 2. 处理重复命名的声明
        if (
          isVariableDeclaration(node) &&
          refVariables.includes(node.name.getText(sourceFile))
        ) {
          // 如果是响应式声明的，保持不变
          if (
            isCallExpression(node.initializer!) &&
            [useEnum.Ref, useEnum.ToRefs, useEnum.Computed].includes(
              node.initializer.expression.getText(sourceFile) as useEnum
            )
          ) {
            return node
          }
          warning += `Duplicate variable declaration found: ${node.name.getText(
            sourceFile
          )}. `
          return factory.updateVariableDeclaration(
            node,
            createIdentifier(
              INCOMPATIBLE_SYNTAX_PLACEHOLDERS[IncompatibleSyntax.SameName]
            ),
            node.exclamationToken,
            node.type,
            node.initializer
          )
        }

        // 3. 处理重复命名的声明(解构赋值形式)
        if (isVariableDeclaration(node) && isObjectBindingPattern(node.name)) {
          // 如果是响应式声明的，保持不变
          if (
            isCallExpression(node.initializer!) &&
            [useEnum.Ref, useEnum.ToRefs, useEnum.Computed].includes(
              node.initializer.expression.getText(sourceFile) as useEnum
            )
          ) {
            return node
          }
          return factory.updateVariableDeclaration(
            node,
            factory.createObjectBindingPattern([
              ...node.name.elements.map((element) => {
                if (refVariables.includes(element.name.getText(sourceFile))) {
                  warning += `Duplicate variable declaration found: ${element.name.getText(
                    sourceFile
                  )}. `

                  return factory.createBindingElement(
                    undefined,
                    undefined,
                    INCOMPATIBLE_SYNTAX_PLACEHOLDERS[
                      IncompatibleSyntax.SameName
                    ],
                    undefined
                  )
                }
                return element
              }),
            ]),
            node.exclamationToken,
            node.type,
            node.initializer
          )
        }

        return visitEachChild(node, visit, context)
      }

      return visitNode(rootNode, visit)
    }
  }

  visitToFindRefVar(sourceFile)

  const result = transform(sourceFile, [transformer])
  const printer = createPrinter()
  const transformedSourceFile = result.transformed[0] as SourceFile

  return {
    output: printer.printFile(transformedSourceFile),
    warning,
  }
}
