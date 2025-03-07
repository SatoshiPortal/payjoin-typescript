import { PayjoinOhttpKeys } from '../src/index';

describe('PayjoinOhttpKeys', () => {
    const validRelay = 'https://pj.bobspacebkk.com';
    const validDirectory = 'https://payjo.in';

    describe('fetch', () => {
        it('should fetch OHTTP keys from valid URLs', async () => {
            const keys = await PayjoinOhttpKeys.fetch(validRelay, validDirectory);
            expect(keys).toBeInstanceOf(PayjoinOhttpKeys);
        });

        it('should throw error for invalid relay URL', async () => {
            await expect(
                PayjoinOhttpKeys.fetch('not-a-url', validDirectory)
            ).rejects.toThrow('Invalid relay URL');
        });

        it('should throw error for invalid directory URL', async () => {
            await expect(
                PayjoinOhttpKeys.fetch(validRelay, 'not-a-url')
            ).rejects.toThrow('Invalid directory URL');
        });
    });

    describe('toBytes and fromBytes', () => {
        it('should round-trip through bytes', async () => {
            const keys = await PayjoinOhttpKeys.fetch(validRelay, validDirectory);
            const bytes = await keys.toBytes();

            
            expect(bytes).toBeInstanceOf(Uint8Array);
            expect(bytes.length).toBeGreaterThan(0);

            const restored = await PayjoinOhttpKeys.fromBytes(bytes);
            expect(restored).toBeInstanceOf(PayjoinOhttpKeys);

            const restoredBytes = await restored.toBytes();
            expect(Buffer.from(restoredBytes)).toEqual(Buffer.from(bytes));
        });

        it('should throw error for invalid bytes', async () => {
            const invalidBytes = new Uint8Array([1, 2, 3, 4]);
            await expect(
                PayjoinOhttpKeys.fromBytes(invalidBytes)
            ).rejects.toThrow('Invalid OHTTP keys');
        });
    });

    describe('error handling', () => {
        it('should handle network errors gracefully', async () => {
            const invalidRelay = 'https://invalid.example.com';
            await expect(
                PayjoinOhttpKeys.fetch(invalidRelay, validDirectory)
            ).rejects.toThrow();
        });
    });
});