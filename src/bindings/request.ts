import { IPayjoinRequest, IPayjoinResponse, IPayjoinV2Context } from "../types";

  export class PayjoinRequest implements IPayjoinRequest {
    private readonly internal: any;

    constructor(internal: any) {
        this.internal = internal;
    }
  
    get nativeHandle() {
      return this.internal;
    }

    url(): string {
      return this.internal.url();
    }
  
    body(): Uint8Array {
      return this.internal.body();
    }
  
    async post(): Promise<Uint8Array> {
        try {
            const response = await this.internal.post();
            return response;
        } catch (error) {
            throw new Error(`Failed to post request: ${error}`);
        }
    }

    async processResponse(response: Uint8Array): Promise<PayjoinResponse> {
      try {
        const result = await this.internal.processResponse(response);
        return new PayjoinResponse(result);
      } catch (error) {
        throw new Error(`Failed to process response: ${error}`);
      }
    }
  }
  
  export class PayjoinResponse implements IPayjoinResponse {
    private readonly internal: any;

    constructor(internal: any) {
        this.internal = internal;
    }
  
    version(): string {
      return this.internal.version();
    }
  
    psbt(): string | null {
      return this.internal.psbt();
    }
  
    v2Context(): PayjoinV2Context | null {
      const context = this.internal.v2Context();
      return context ? new PayjoinV2Context(context) : null;
    }
  }
  
  export class PayjoinV2Context implements IPayjoinV2Context {
    private readonly internal: any;

    constructor(internal: any) {
        this.internal = internal;
    }
  
    async extractRequest(ohttpRelay: string): Promise<PayjoinRequest> {
      try {
        const request = await this.internal.extractRequest(ohttpRelay);
        return new PayjoinRequest(request);
      } catch (error) {
        throw new Error(`Failed to extract request: ${error}`);
      }
    }

    async processResponse(response: Uint8Array, request: PayjoinRequest): Promise<string> {
      try {
        const result = await this.internal.processResponse(response, request.nativeHandle);
        return result;
      } catch (error) {
        throw new Error(`Failed to process response: ${error}`);
      }
    }
  }