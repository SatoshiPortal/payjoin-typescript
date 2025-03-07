import native from '../src/native';

describe('Native bindings', () => {
  const expectedExports = [
    // Core classes
    'PayjoinReceiver',
    'PayjoinSender',
    'PayjoinSenderBuilder',
    
    // URI related
    'BtcUri',
    'CheckedBtcUri',
    'PayjoinUrl',
    'PayjoinUri',
    'PayjoinUriBuilder',
    
    // State machine wrappers
    'MaybeInputsOwnedWrapper',
    'MaybeInputsSeenWrapper',
    'OutputsUnknownWrapper',
    'WantsOutputsWrapper',
    'WantsInputsWrapper',
    'ProvisionalProposalWrapper',
    'PayjoinProposalWrapper',
    'UncheckedProposalWrapper',
    
    // Request/Response handling
    'PayjoinRequest',
    'PayjoinResponse',
    'OhttpContext',
    'PayjoinV2Context',
    
    // OHTTP functionality
    'PayjoinOhttpKeys',
  ];

  const expectedTypes = {
    PayjoinReceiver: 'function',
    PayjoinSender: 'function',
    PayjoinSenderBuilder: 'function',
    PayjoinOhttpKeys: 'function',
  };

  it('should export all required native structures', () => {
    const exports = Object.keys(native);
    expectedExports.forEach(exp => {
      expect(exports).toContain(exp);
    });
  });

  it('should have correct types for core classes', () => {
    Object.entries(expectedTypes).forEach(([className, expectedType]) => {
      expect(typeof native[className]).toBe(expectedType);
    });
  });

  it('should allow instantiation of core classes', () => {
    // Test constructors exist
    expect(native.PayjoinReceiver.prototype.constructor).toBeDefined();
    expect(native.PayjoinSenderBuilder.prototype.constructor).toBeDefined();
    expect(native.PayjoinOhttpKeys.prototype.constructor).toBeDefined();
  });

  it('should match expected export count', () => {
    const exports = Object.keys(native);
    expect(exports.length).toBe(expectedExports.length);
    
    // Log any unexpected exports
    const unexpected = exports.filter(exp => !expectedExports.includes(exp));
    if (unexpected.length > 0) {
      console.warn('Unexpected exports found:', unexpected);
    }
  });
});