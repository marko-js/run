import type { Context } from "@netlify/edge-functions";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";

export interface NetlifyFunctionsPlatformInfo {
  event: HandlerEvent;
  context: HandlerContext;
  ip: string;
}

export interface NetlifyEdgePlatformInfo {
  context: Context;
}
