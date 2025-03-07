export interface IPayjoinOhttpKeysStatic {
    fromBytes(bytes: Uint8Array): Promise<IPayjoinOhttpKeys>;
    fetch(ohttpRelay: string, payjoinDirectory: string): Promise<IPayjoinOhttpKeys>;
}

export interface IPayjoinOhttpKeys {
    toBytes(): Promise<Uint8Array>;
}