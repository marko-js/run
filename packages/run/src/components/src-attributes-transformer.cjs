"use strict";

const markoUtils = require("@marko/babel-utils");
const attrTags = {
  src: [
    "audio",
    "embed",
    "iframe",
    "img",
    "input",
    "script",
    "source",
    "track",
    "video",
  ],
  href: ["a", "area", "link"],
  data: ["object"],
  poster: ["video"],
  srcset: ["img"],
  //something else needs to happen here
  background: ["body"],
};

const assetFileReg =
  /(?:^\..*\.(?:a?png|jpe?g|jfif|pipeg|pjp|gif|svg|ico|web[pm]|avif|mp4|ogg|mp3|wav|flac|aac|opus|woff2?|eot|[ot]tf|webmanifest|pdf|txt)(\?|$)|\?url\b)/;

const tagAttrs = Object.keys(attrTags).reduce((tagAttrs, attrName) => {
  attrTags[attrName].forEach((tagName) => {
    tagAttrs[tagName] = tagAttrs[tagName] || {};
    tagAttrs[tagName][attrName] = true;
  });
  return tagAttrs;
}, {});

module.exports = function (a, b) {
  if (a.hub) {
    return transformMarko5(a, b);
  }

  return transformMarko4(a, b);
};

function transformMarko5(path) {
  if (!path.get("name").isStringLiteral()) {
    return;
  }

  const tagName = path.get("name.value").node;
  const checkAttrs = tagAttrs[tagName];
  if (!checkAttrs) {
    return;
  }

  path.get("attributes").forEach((attr) => {
    if (!checkAttrs[attr.node.name]) {
      return;
    }

    if (
      attr.get("value").isStringLiteral() &&
      assetFileReg.test(attr.node.value)
    ) {
      attr.set(
        "value",
        markoUtils.importDefault(path.hub.file, value, "asset"),
      );
    }
  });
}

function transformMarko4(el, context) {
  const checkAttrs = tagAttrs[el.tagName];
  if (!checkAttrs) {
    return;
  }

  el.attributes.forEach((attr) => {
    if (!checkAttrs[attr.name]) {
      return;
    }

    const walker = context.createWalker({
      enter: (node) => {
        switch (node.type) {
          case "ArrayExpression":
          case "ObjectExpression":
          case "Property":
          case "LogicalExpression":
            return;
          case "ConditionalExpression":
            node.consequent = walker.walk(node.consequent);
            node.alternate = walker.walk(node.alternate);
            walker.skip();
            break;
          case "Literal": {
            const { value } = node;

            if (!assetFileReg.test(value)) {
              return;
            }

            context.assetCount = context.assetCount || 0;
            const varName = `__src_asset_${context.assetCount++}__`;
            const tagString = `import ${varName} from ${JSON.stringify(value)}`;
            const importTag = context.createNodeForEl("import");
            importTag.tagString = tagString;
            context.root.prependChild(importTag);
            walker.replace(context.builder.identifier(varName));
            break;
          }
          default:
            walker.skip();
            break;
        }
      },
    });

    attr.value = walker.walk(attr.value);
  });
}
