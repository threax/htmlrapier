﻿///<amd-module name="hr.fetcher"/>

// Type definitions for Fetch API
// Altered to fit htmlrapier by Andrew Piper
// Based on:
// Project: https://github.com/github/fetch
// Definitions by: Ryan Graham <https://github.com/ryan-codingintrigue>, Kagami Sascha Rosylight <https://github.com/saschanaz>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

export function fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
    return (<any>window).fetch(url, init);
}

export declare type HeadersInit = Headers | string[][] | { [key: string]: string };
export declare class Headers {
    constructor(init?: HeadersInit);

    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string; // | null; (TS 2.0 strict null check)
    has(name: string): boolean;
    set(name: string, value: string): void;

    // WebIDL pair iterator: iterable<ByteString, ByteString>
    //entries(): IterableIterator<[string, string]>;
    forEach(callback: (value: string, index: number, headers: Headers) => void, thisArg?: any): void;
    //keys(): IterableIterator<string>;
    //values(): IterableIterator<string>;
    //[Symbol.iterator](): IterableIterator<[string, string]>;
}

export declare type BodyInit = Blob | ArrayBufferView | ArrayBuffer | FormData /* | URLSearchParams */ | string;
export interface Body {
    bodyUsed: boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    formData(): Promise<FormData>;
    json(): Promise<any>;
    text(): Promise<string>;
}

export declare type RequestInfo = Request | string;
export declare class Request {
    constructor(input: RequestInfo, init?: RequestInit);

    method: string;
    url: string;
    headers: Headers;

    type: RequestType
    destination: RequestDestination;
    referrer: string;
    referrerPolicy: ReferrerPolicy;
    mode: RequestMode;
    credentials: RequestCredentials;
    cache: RequestCache;
    redirect: RequestRedirect;
    integrity: string;

    clone(): Request;
}
export interface Request extends Body { }
export interface RequestInit {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    mode?: RequestMode;
    credentials?: RequestCredentials;
    cache?: RequestCache;
    redirect?: RequestRedirect;
    integrity?: string;
    window?: any;
}

export type RequestType = "" | "audio" | "font" | "image" | "script" | "style" | "track" | "video";
export type RequestDestination = "" | "document" | "embed" | "font" | "image" | "manifest" | "media" | "object" | "report" | "script" | "serviceworker" | "sharedworker" | "style" | "worker" | "xslt";
export type RequestMode = "navigate" | "same-origin" | "no-cors" | "cors";
export type RequestCredentials = "omit" | "same-origin" | "include";
export type RequestCache = "default" | "no-store" | "reload" | "no-cache" | "force-cache" | "only-if-cached";
export type RequestRedirect = "follow" | "error" | "manual";
export type ReferrerPolicy = "" | "no-referrer" | "no-referrer-when-downgrade" | "same-origin" | "origin" | "strict-origin" | "origin-when-cross-origin" | "strict-origin-when-cross-origin" | "unsafe-url";

export declare class Response {
    constructor(body?: BodyInit, init?: ResponseInit);

    static error(): Response;
    static redirect(url: string, status?: number): Response;

    type: ResponseType;
    url: string;
    redirected: boolean;
    status: number;
    ok: boolean;
    statusText: string;
    headers: Headers;
    body: any; // | null;
    trailer: Promise<Headers>;

    clone(): Response;
}
export interface Response extends Body { }
export interface ResponseInit {
    status?: number;
    statusText?: string;
    headers?: HeadersInit;
}

export type ResponseType = "basic" | "cors" | "default" | "error" | "opaque" | "opaqueredirect";

export abstract class Fetcher {
    abstract fetch(url: RequestInfo, init?: RequestInit): Promise<Response>;
}