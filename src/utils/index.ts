
export class PayjoinHttp {

  static async sendV2Request(url: string, body: Uint8Array): Promise<Uint8Array> {
    const relayResponse = await fetch(url, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'message/ohttp-req',
        'Accept': 'message/ohttp-res'
      }
    });

    if (!relayResponse.ok) {
      throw new Error(`Relay request failed: ${relayResponse.status}`);
    }

    return new Uint8Array(await relayResponse.arrayBuffer());
  }
}