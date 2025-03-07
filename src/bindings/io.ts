import { IPayjoinOhttpKeys } from '../types';
import native from '../native';

export class PayjoinOhttpKeys implements IPayjoinOhttpKeys {
    constructor(private readonly internal: any) {}

    static async fromBytes(bytes: Uint8Array): Promise<PayjoinOhttpKeys> {
        try {
            const keys = await native.PayjoinOhttpKeys.fromBytes(bytes);
            return new PayjoinOhttpKeys(keys);
        } catch (error) {
            throw new Error(`Failed to decode OHTTP keys: ${error}`);
        }
    }

    static async fetch(
        ohttpRelay: string,
        payjoinDirectory: string
    ): Promise<PayjoinOhttpKeys> {
        try {
            const keys = await native.PayjoinOhttpKeys.fetch(ohttpRelay, payjoinDirectory);
            return new PayjoinOhttpKeys(keys);
        } catch (error) {
            throw new Error(`Failed to fetch OHTTP keys: ${error}`);
        }
    }

    async toBytes(): Promise<Uint8Array> {
        try {
            return await this.internal.toBytes();
        } catch (error) {
            throw new Error(`Failed to encode OHTTP keys: ${error}`);
        }
    }
}
