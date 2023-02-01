export interface Writer {
  indent: number;
  branch(name: string): Writer;
  join(closeBranches?: boolean): void;
  write(data: string, indent?: boolean): Writer;
  writeLines(...lines: string[]): Writer;
  writeBlockStart(data: string): Writer;
  writeBlockEnd(data: string): Writer;
  writeBlock(start: string, lines: string[], end: string): Writer;
}

export interface WriterOptions {
  indentWith?: string,
  onJoin?: (writer: Writer) => void;
}

interface WriterInternal extends Writer {
  __isActive: boolean;
}

interface Branch {
  writer: Writer;
  buffer: string
}

export function createWriter(sink: (data: string) => void, options?: WriterOptions): Writer {
  let buffer: string = "";
  let indentLevel = 0;
  let indentString = '';
  let firstOpenIndex = 0;
  const branches: (Branch | null)[] = [];
  const openWriters = new Map<string, Writer>();

  function write(data: string) {
    if (!writer.__isActive) {
      throw new Error('Cannot write to branch that has been joined')
    }
    if (openWriters.size) {
      buffer += data;
    } else {
      sink(data);
    }
    return writer;
  }

  const writer: WriterInternal = {
    __isActive: true,
    get indent() {
      return indentLevel
    },
    set indent(value) {
      if (options?.indentWith) {
        if (value < 0) {
          value = 0;
        }
        if (value !== indentLevel) {
          indentLevel = value;
          indentString = options.indentWith.repeat(indentLevel);
        }
      }
    },
    write(data, indent = false) {
      if (indent && indentString) {
        write(indentString);
      }
      return write(data);
    },
    writeLines(...lines) {
      for (const line of lines) {
        if (line) {
          writer.write(line, true)
        }
        writer.write('\n');
      }
      return writer;
    },
    writeBlockStart(data: string) {
      writer.writeLines(data).indent++;
      return writer;
    },
    writeBlockEnd(data: string = '}') {
      writer.indent--;
      writer.writeLines(data);
      return writer;
    },
    writeBlock(start, lines, end) {
      return writer
        .writeBlockStart(start)
        .writeLines(...lines)
        .writeBlockEnd(end);
    },
    branch(name) {
      let existing = openWriters.get(name);
      if (existing) {
        return existing;
      }

      const branch: Branch = {
        buffer,
        writer: createWriter(
          (data) => {
            branch.buffer += data;
          },
          {
            ...options,
            onJoin() {
              openWriters.delete(name);
              for (let i = firstOpenIndex; i < branches.length; i++) {
                const b = branches[i];
                if (!b) {
                  continue;
                } else if ((b.writer as WriterInternal).__isActive) {
                  break;
                }
                sink(b.buffer);
                branches[i] = null;
                firstOpenIndex++;
              }
            },
          }
        )
      };

      branch.writer.indent = indentLevel;
      openWriters.set(name, branch.writer);
      branches.push(branch);
      buffer = '';

      return branch.writer;
    },
    join(recursive) {
      if (writer.__isActive) {
        if (openWriters.size) {
          if (recursive) {
            for (const branch of openWriters.values()) {
              branch.join(true);
            }
          } else {
            throw new Error(
              `Cannot join a Writer with un-joined branches - use the \`recursive\` argument to join all open branches`
            );
          }
        }
        buffer && sink(buffer);
        writer.__isActive = false;
        options?.onJoin?.(writer);
      }
    },
  };

  return writer;
}

interface StringWriter extends Writer {
  end(): string
}

export function createStringWriter(opts?: WriterOptions) : StringWriter {
  let code = '';
  const writer = createWriter(data => { code += data}, { indentWith: '\t', ...opts });
  return Object.assign(writer, {
    end() {
      writer.join(true);
      return code;
    }
  })
}