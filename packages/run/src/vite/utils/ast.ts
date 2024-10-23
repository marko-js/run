import * as t from "@babel/types";

export function getExportIdentifiers(astProgramNode: any): string[] {
  const result: string[] = [];

  if (t.isProgram(astProgramNode)) {
    for (const node of astProgramNode.body) {
      if (t.isExportNamedDeclaration(node)) {
        const { declaration, specifiers } = node;

        if (declaration) {
          if (t.isFunctionDeclaration(declaration) && declaration.id) {
            // export function foo() {}
            result.push(declaration.id.name);
          } else if (t.isVariableDeclaration(declaration)) {
            // export const foo = () => {}, bar;
            for (const declarator of declaration.declarations) {
              if (t.isIdentifier(declarator.id)) {
                result.push(declarator.id.name);
              }
            }
          }
        } else if (specifiers) {
          for (const specifier of specifiers) {
            if (
              t.isExportSpecifier(specifier) &&
              t.isIdentifier(specifier.exported)
            ) {
              // export { foo, baz as bar  }
              result.push(specifier.exported.name);
            }
          }
        }
      } else if (t.isExportDefaultDeclaration(node)) {
        result.push("default");
      }
    }
  }

  return result;
}

export function getViteSSRExportIdentifiers(
  astProgramNode: any,
  exportObjectName: string = "__vite_ssr_exports__",
): string[] {
  const result: string[] = [];

  if (t.isProgram(astProgramNode)) {
    for (const node of astProgramNode.body) {
      if (t.isExpressionStatement(node)) {
        if (
          t.isAssignmentExpression(node.expression) &&
          t.isMemberExpression(node.expression.left)
        ) {
          // __vite_ssr_exports__.XXX = ...
          const { object, property } = node.expression.left;
          if (
            t.isIdentifier(object) &&
            object.name === exportObjectName &&
            t.isIdentifier(property)
          ) {
            result.push(property.name);
          }
        } else if (
          t.isCallExpression(node.expression) &&
          t.isMemberExpression(node.expression.callee)
        ) {
          //Object.defineProperty(__vite_ssr_exports__, "XXX", ...)
          const {
            arguments: [arg0, arg1],
          } = node.expression;
          if (
            t.isIdentifier(arg0) &&
            arg0.name === exportObjectName &&
            (t.isStringLiteral(arg1) ||
              ("value" in arg1 && typeof arg1.value === "string"))
          ) {
            result.push(arg1.value);
          }
        }
      }
    }
  }

  return result;
}
