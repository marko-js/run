import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import type { Context } from "@netlify/edge-functions";

export interface NetlifyFunctionsPlatformInfo {
  event: HandlerEvent;
  context: HandlerContext;
  ip: string;
}

export interface NetlifyEdgePlatformInfo {
  context: Context;
}
