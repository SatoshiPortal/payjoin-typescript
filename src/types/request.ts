
export interface IPayjoinRequest {
  url(): string;
  body(): Uint8Array;
  post(): Promise<Uint8Array>;
  processResponse(response: Uint8Array): Promise<IPayjoinResponse>;
}

export interface IPayjoinResponse {
  version(): string;
  psbt(): string | null;
  v2Context(): IPayjoinV2Context | null;
}

export interface IPayjoinV2Context {
  extractRequest(ohttpRelay: string): Promise<IPayjoinRequest>;
  processResponse(response: Uint8Array, request: IPayjoinRequest): Promise<string>;
}
