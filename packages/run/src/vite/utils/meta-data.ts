import {
  NormalizedMeta,
  NormalizedMetaLookup,
  Verb,
} from "../../runtime/types";
import { httpVerbs } from "../constants";

const verbKeys = new Set(httpVerbs.map((v) => v.toUpperCase() as Verb));

function isObject(obj: any): obj is Record<PropertyKey, any> {
  return obj && typeof obj === "object" && !Array.isArray(obj);
}

export function getMetaDataForVerb<T, TVerb extends Verb>(
  data: T,
  verb: TVerb,
): NormalizedMeta<T, TVerb> {
  if (!httpVerbs.includes(verb.toLowerCase() as any)) {
    throw new Error(
      `Invalid argument 'verb': expected one of ${[...verbKeys].join(", ")} but received ${verb}`,
    );
  }
  if (isObject(data)) {
    return Object.keys(data).reduce(
      (result, key) => {
        if (!(key in result || verbKeys.has(key as Verb))) {
          result[key] = data[key];
        }
        return result;
      },
      isObject(data[verb]) ? { ...data[verb] } : ({} as any),
    );
  }
  return data as any;
}

export function getMetaDataLookup<T>(data: T): NormalizedMetaLookup<T> {
  const lookup = {} as any;
  for (const verb of verbKeys) {
    lookup[verb] = getMetaDataForVerb(data, verb);
  }
  return lookup;
}
