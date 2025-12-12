import { types as t } from "@marko/compiler";

export default {
  Program(program: t.NodePath<t.Program>) {
    if (
      /dist[\\/]\.marko-run[\\/].+(?<!entry)\.marko$/.test(
        program.hub.file.opts.filename,
      )
    ) {
      program.node.body.push(
        t.markoPlaceholder(
          t.templateLiteral(
            [
              t.templateElement({
                raw: "<script>app.append(new Text('route entry: ",
                cooked: "<script>app.append(new Text('route entry: ",
              }),
              t.templateElement(
                { raw: "'))</script>", cooked: "'))</script>" },
                true,
              ),
            ],
            [
              t.conditionalExpression(
                t.binaryExpression(
                  "===",
                  t.unaryExpression("typeof", t.identifier("component")),
                  t.stringLiteral("object"),
                ),
                t.stringLiteral("class"),
                t.stringLiteral("tags"),
              ),
            ],
          ),
          false,
        ),
      );
    }
  },
};
