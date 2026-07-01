import {
  PaymentProcessor,
  decryptCredentialPayload,
  encryptCredentialPayload,
} from '../src/models/PaymentProcessor.js';

describe('PaymentProcessor credential encryption boundary', () => {
  const context = {
    businessId: 'business-1',
    processorId: 'processor-1',
    processorType: 'stripe',
  };

  const credentials = {
    secret_key: 'sk_live_sensitive_value',
    webhook_secret: 'whsec_sensitive_value',
    publishable_key: 'pk_live_publicish',
  };

  it('stores ciphertext and masked metadata without plaintext credentials', () => {
    const processor = new PaymentProcessor();
    processor.id = context.processorId;
    processor.business_id = context.businessId;
    processor.processor_type = 'stripe';

    processor.setEncryptedCredentials(credentials, {
      keyMaterial: 'unit-test-key-material-32-byte-minimum',
      keyVersion: 'test-v1',
      kmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/test',
      rotatedAt: new Date('2026-06-20T00:00:00Z'),
    });

    const dump = JSON.stringify(processor);
    expect(dump).not.toContain(credentials.secret_key);
    expect(dump).not.toContain(credentials.webhook_secret);
    expect(processor.credentials).toBeUndefined();
    expect(processor.encrypted_credentials?.ciphertext).toBeTruthy();
    expect(processor.credential_metadata?.masked.secret_key).toMatch(/alue$/);
    expect(processor.credential_kms_key_id).toContain('arn:aws:kms');
  });

  it('decrypts only with the same business encryption context and an audit reason', () => {
    const processor = new PaymentProcessor();
    processor.id = context.processorId;
    processor.business_id = context.businessId;
    processor.processor_type = 'stripe';
    processor.setEncryptedCredentials(credentials, {
      keyMaterial: 'unit-test-key-material-32-byte-minimum',
      keyVersion: 'test-v1',
    });

    expect(() => processor.decryptCredentials({ keyMaterial: 'unit-test-key-material-32-byte-minimum' })).toThrow(/audit reason/);
    expect(processor.decryptCredentials({
      keyMaterial: 'unit-test-key-material-32-byte-minimum',
      auditReason: 'settlement charge creation',
    })).toEqual(credentials);

    processor.business_id = 'business-2';
    expect(() => processor.decryptCredentials({
      keyMaterial: 'unit-test-key-material-32-byte-minimum',
      auditReason: 'cross-context test',
    })).toThrow(/context mismatch|Unsupported state|authenticate/i);
  });

  it('rejects corrupt ciphertext, disabled old key material, and unauthorized context', () => {
    const envelope = encryptCredentialPayload(
      credentials,
      context,
      'test-v1',
      'unit-test-key-material-32-byte-minimum'
    );

    expect(() =>
      decryptCredentialPayload(envelope, context, 'rotated-disabled-key-material')
    ).toThrow();

    expect(() =>
      decryptCredentialPayload({ ...envelope, ciphertext: 'not-base64' }, context, 'unit-test-key-material-32-byte-minimum')
    ).toThrow();

    expect(() =>
      decryptCredentialPayload(
        envelope,
        { ...context, businessId: 'business-2' },
        'unit-test-key-material-32-byte-minimum'
      )
    ).toThrow(/context mismatch/);
  });
});
