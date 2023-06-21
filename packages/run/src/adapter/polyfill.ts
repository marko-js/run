import * as webStream from 'stream/web';
import { webcrypto } from 'crypto';
import * as undici from 'undici';

(globalThis as any).crypto ??= webcrypto;
(globalThis as any).fetch ??= undici.fetch;
(globalThis as any).Response ??= undici.Response;
(globalThis as any).Request ??= undici.Request;
(globalThis as any).Headers ??= undici.Headers;
(globalThis as any).ReadableStream ??= webStream.ReadableStream;
(globalThis as any).TransformStream ??= webStream.TransformStream;
(globalThis as any).WritableStream ??= webStream.WritableStream;
(globalThis as any).FormData ??= undici.FormData;
(globalThis as any).File ??= undici.File;

declare module 'http' {
	interface OutgoingMessage {
		appendHeader(this: OutgoingMessage, name: string, value: string): this;
	}
}

declare global {
	interface Headers {
		getSetCookie?: () => string[]
	}
}
