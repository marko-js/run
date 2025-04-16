import type { Context as EdgeContext } from "@netlify/edge-functions";
import type { Context as FunctionsContext } from "@netlify/functions";

export interface NetlifyFunctionsPlatformInfo extends FunctionsContext {}

export interface NetlifyEdgePlatformInfo extends EdgeContext {}
