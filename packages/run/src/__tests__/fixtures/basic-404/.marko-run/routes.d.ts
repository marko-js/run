/*
  WARNING: This file is automatically generated and any changes made to it will be overwritten without warning.
  Do NOT manually edit this file or your changes will be lost.
*/

import type { HandlerLike, Route as AnyRoute, Context as AnyContext, ParamsObject, ValidatePath, ValidateHref } from "@marko/run";

interface NoParams extends ParamsObject {}
interface NoMeta {}

type Get =
  | '/';

type Post = never;

type Route1 = AnyRoute<NoParams, NoMeta, `/`>;

declare global {
  namespace MarkoRun {
    type GetPaths = Get;
    type PostPaths = Post;
    type GetablePath<T extends string> = ValidatePath<Get, T>;
    type GetableHref<T extends string> = ValidateHref<Get, T>; 
    type PostablePath<T extends string> = ValidatePath<Post, T>;
    type PostableHref<T extends string> = ValidateHref<Post, T>;
    type Platform = unknown;
  }
}

declare module '../../../../routes/+page.marko' {
  export interface Input {
    renderBody: Marko.Body;
  }

  namespace MarkoRun {
    type GetPaths = Get;
    type PostPaths = Post;
    type GetablePath<T extends string> = ValidatePath<Get, T>;
    type GetableHref<T extends string> = ValidateHref<Get, T>; 
    type PostablePath<T extends string> = ValidatePath<Post, T>;
    type PostableHref<T extends string> = ValidateHref<Post, T>;
    type Platform = unknown;
    type Route = Route1;
    type Context = AnyContext<Platform, Route> & Marko.Global;
    type Handler<_Params = Route['params'], _Meta = Route['meta']> = HandlerLike<Route>;
    function route(handler: Handler): typeof handler;
    function route<_Params = Route['params'], _Meta = Route['meta']>(handler: Handler): typeof handler;
    const NotHandled: unique symbol;
    const NotMatched: unique symbol;
  }
}

declare module '../../../../routes/+layout.marko' {
  export interface Input {
    renderBody: Marko.Body;
  }

  namespace MarkoRun {
    type GetPaths = Get;
    type PostPaths = Post;
    type GetablePath<T extends string> = ValidatePath<Get, T>;
    type GetableHref<T extends string> = ValidateHref<Get, T>; 
    type PostablePath<T extends string> = ValidatePath<Post, T>;
    type PostableHref<T extends string> = ValidateHref<Post, T>;
    type Platform = unknown;
    type Route = Route1;
    type Context = AnyContext<Platform, Route> & Marko.Global;
    type Handler<_Params = Route['params'], _Meta = Route['meta']> = HandlerLike<Route>;
    function route(handler: Handler): typeof handler;
    function route<_Params = Route['params'], _Meta = Route['meta']>(handler: Handler): typeof handler;
    const NotHandled: unique symbol;
    const NotMatched: unique symbol;
  }
}

declare module '../../../../routes/+404.marko' {
  export interface Input {}

  namespace MarkoRun {
    type GetPaths = Get;
    type PostPaths = Post;
    type GetablePath<T extends string> = ValidatePath<Get, T>;
    type GetableHref<T extends string> = ValidateHref<Get, T>; 
    type PostablePath<T extends string> = ValidatePath<Post, T>;
    type PostableHref<T extends string> = ValidateHref<Post, T>;
    type Platform = unknown;
    type Route = AnyRoute;
    type Context = AnyContext<Platform, Route> & Marko.Global;
    type Handler<_Params = Route['params'], _Meta = Route['meta']> = HandlerLike<Route>;
    function route(handler: Handler): typeof handler;
    function route<_Params = Route['params'], _Meta = Route['meta']>(handler: Handler): typeof handler;
    const NotHandled: unique symbol;
    const NotMatched: unique symbol;
  }
}
