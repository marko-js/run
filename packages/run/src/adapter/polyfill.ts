import { ReadableStream, TransformStream, WritableStream } from 'stream/web';
import { webcrypto as crypto } from 'crypto';
import { fetch, Response, Request, Headers, FormData, File } from 'undici';
import { OutgoingMessage } from 'http';

const globals: Record<string, unknown> = {
	crypto,
	fetch,
	Response,
	Request,
	Headers,
	ReadableStream,
	TransformStream,
	WritableStream,
	FormData,
	File
};

declare module 'http' {
	interface OutgoingMessage {
		appendHeader(this: OutgoingMessage, name: string, value: string): this;
	}
}

if (typeof OutgoingMessage.prototype.appendHeader !== 'function') {
	const messageHeaders = new WeakMap<OutgoingMessage, Map<string, string | string[]>>();
	OutgoingMessage.prototype.appendHeader = function(name, value) {
		let headers = messageHeaders.get(this);
		if (!headers) {
			headers = new Map();
			messageHeaders.set(this, headers);
		}

		const key = name.toLowerCase();
		let existing = headers.get(key);
		if (existing) {
			if (Array.isArray(existing)) {
				existing.push(value);
			} else {
				existing = [existing, value];
			}
			this.setHeader(name, existing);
			headers.set(key, existing);
		} else {
			this.setHeader(name, value);
			headers.set(key, value);
		}

		return this;
	}
}

export function installPolyfills() {
	for (const name in globals) {
		if (!(name in globalThis)) {
			Object.defineProperty(globalThis, name, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: globals[name]
			});
		}
	}
}