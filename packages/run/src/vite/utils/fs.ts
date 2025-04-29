import path from "path";

const POSIX_SEP = "/";
const WINDOWS_SEP = "\\";
export const normalizePath =
  path.sep === WINDOWS_SEP
    ? (id: string) => id.replace(/\\/g, POSIX_SEP)
    : (id: string) => id;
