const kPromise = Symbol("promise");
const kReadFn = Symbol("read fn");

export interface Thenable<T = any> extends Promise<T> {
  [kPromise]: null | Promise<T>;
  [kReadFn]: () => Promise<T>;
  then: Promise<T>["then"];
  catch: Promise<T>["catch"];
  finally: Promise<T>["finally"];
}

function thenFn(
  this: Thenable,
  resolve: Parameters<Thenable["then"]>[0],
  reject: Parameters<Thenable["then"]>[1],
) {
  return (this[kPromise] ||= this[kReadFn]()).then(resolve, reject);
}

function catchFn(this: Thenable, reject: Parameters<Thenable["catch"]>[0]) {
  return (this[kPromise] ||= this[kReadFn]()).catch(reject);
}

function finallyFn(
  this: Thenable,
  resolve: Parameters<Thenable["finally"]>[0],
) {
  return (this[kPromise] ||= this[kReadFn]()).finally(resolve);
}

export default function thenable<T>(fn: () => Promise<T>) {
  return {
    [kPromise]: null,
    [kReadFn]: fn,
    then: thenFn,
    catch: catchFn,
    finally: finallyFn,
  } as Thenable<T>;
}
