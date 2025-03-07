import { UriBuilder } from '../src/index';

describe('UriBuilder', () => {
    const validAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    const validEndpoint = 'https://example.com';

    describe('constructor', () => {
        it('should create a new UriBuilder instance', () => {
            const builder = new UriBuilder(validAddress, validEndpoint);
            expect(builder).toBeInstanceOf(UriBuilder);
        });

        it('should throw error for invalid address', () => {
            expect(() => {
                new UriBuilder('invalid-address', validEndpoint);
            }).toThrow('Failed to create PayjoinUriBuilder');
        });

        it('should throw error for invalid endpoint', () => {
            expect(() => {
                new UriBuilder(validAddress, 'not-a-url');
            }).toThrow('Failed to create PayjoinUriBuilder');
        });
    });

    describe('builder methods', () => {
        let builder: UriBuilder;

        beforeEach(() => {
            builder = new UriBuilder(validAddress, validEndpoint);
        });

        it('should set amount', () => {
            const result = builder.amount(100000);
            expect(result).toBe(builder);
        });

        it('should set message', () => {
            const result = builder.message('Test payment');
            expect(result).toBe(builder);
        });

        it('should set label', () => {
            const result = builder.label('Test label');
            expect(result).toBe(builder);
        });

        it('should disable output substitution', () => {
            const result = builder.disableOutputSubstitution();
            expect(result).toBe(builder);
        });

        it('should chain methods', () => {
            const uri = builder
                .amount(100000)
                .message('Test payment')
                .label('Test label')
                .disableOutputSubstitution()
                .build();

            expect(typeof uri).toBe('string');
            expect(uri).toContain(validAddress);
            expect(uri).toContain('amount=');
            expect(uri).toContain('message=Test%20payment');
            expect(uri).toContain('label=Test%20label');
            expect(uri).toContain('pjos=1');
        });
    });

    describe('build', () => {
        it('should build a valid BIP21 URI with PayJoin parameters', () => {
            const builder = new UriBuilder(validAddress, validEndpoint);
            const uri = builder.amount(100000).build();
            
            expect(uri).toMatch(/^bitcoin:/);
            expect(uri).toContain(validAddress);
            expect(uri).toContain('amount=0.001');
            expect(uri).toContain(validEndpoint.toUpperCase());
        });
    });
});