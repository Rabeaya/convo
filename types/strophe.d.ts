/**
 * Type definitions for strophe.js
 * Since @types/strophe.js may not be available or compatible, we define our own types
 */

declare module 'strophe.js' {
  export enum Status {
    ERROR = 0,
    CONNECTING = 1,
    CONNFAIL = 2,
    AUTHENTICATING = 3,
    AUTHFAIL = 4,
    CONNECTED = 5,
    DISCONNECTED = 6,
    DISCONNECTING = 7,
    ATTACHED = 8,
    REDIRECT = 9,
  }

  export interface ConnectionOptions {
    keepalive?: boolean;
    [key: string]: any;
  }

  export interface Handler {
    (stanza: Element): boolean | void;
  }

  export class Connection {
    constructor(boshUrl: string, options?: ConnectionOptions);
    
    connect(jid: string, password: string, callback: (status: number) => void): void;
    disconnect(): void;
    reset(): void;
    
    send(stanza: Element | string): void;
    sendIQ(iq: Element, success?: (response: Element) => void, error?: (error: Element) => void): void;
    
    addHandler(handler: Handler, ns?: string, name?: string, type?: string | null, id?: string | null, from?: string | null): Handler | null;
    deleteHandler(handler: Handler): void;
    
    rawInput?: (data: string) => void;
    rawOutput?: (data: string) => void;
  }

  export function $iq(params?: {
    to?: string;
    type?: string;
    id?: string;
    from?: string;
  }): Builder;

  export function $msg(params?: {
    to?: string;
    from?: string;
    type?: string;
    id?: string;
  }): Builder;

  export function $pres(params?: {
    to?: string;
    from?: string;
    type?: string;
  }): Builder;

  export interface Builder {
    tree(): Element;
    c(name: string, attrs?: Record<string, string>): Builder;
    t(text: string): Builder;
    up(): Builder;
  }

  export function serialize(element: Element | string): string;

  export const Strophe: {
    Status: typeof Status;
    serialize: typeof serialize;
  };
}










