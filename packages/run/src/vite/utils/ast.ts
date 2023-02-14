import * as t from '@babel/types';

export function getExportIdentifiers(astProgramNode: any): string[] {
  const result: string[] = [];

  if (t.isProgram(astProgramNode)) {
    for (const node of astProgramNode.body) {
      if (t.isExportNamedDeclaration(node)) {
        const { declaration, specifiers } = node;

        if (declaration) {
          if (t.isFunctionDeclaration(declaration) && declaration.id) {
            // export function foo() {}
            result.push(declaration.id.name)
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
            if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.exported)) {
              // export { foo, baz as bar  }
              result.push(specifier.exported.name);
            }
          }
        }
      } else if (t.isExportDefaultDeclaration(node)) {
        const { declaration } = node;
        if (t.isObjectExpression(declaration)) {
          // export default { foo() {}, bar };
          for (const property of declaration.properties) {
            if (t.isObjectMember(property) && t.isIdentifier(property.key)) {
              result.push(property.key.name);
            }
          }
        }
      }
    }
  }

  return result;
}