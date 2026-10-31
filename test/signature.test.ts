import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyCampfireSignature } from '../nodes/CampfireTrigger/signature';

const TEST_KEY = 'x'.repeat(50);
const BODY =
	'{"webhook_uuid":"3c88df19-1c1f-4b1c-b4a7-768793055a60","topic":"Invoice.paid","data":{"id":12345}}';
const NOW = 1770000000;

/** The reference implementation from Campfire's webhooks guide. */
function sign(secret: string, timestamp: string, body: string): string {
	return createHmac('sha256', secret).update(`${timestamp}:${body}`).digest('hex');
}

const valid = {
	secret: TEST_KEY,
	rawBody: Buffer.from(BODY),
	timestampHeader: String(NOW),
	signatureHeader: sign(TEST_KEY, String(NOW), BODY),
	nowSeconds: NOW,
};

describe('verifyCampfireSignature', () => {
	it('accepts a delivery signed the way Campfire documents', () => {
		expect(verifyCampfireSignature(valid)).toBe(true);
		expect(verifyCampfireSignature({ ...valid, rawBody: BODY })).toBe(true);
	});

	it('accepts upper-case hex', () => {
		expect(
			verifyCampfireSignature({ ...valid, signatureHeader: valid.signatureHeader.toUpperCase() }),
		).toBe(true);
	});

	it('rejects a changed body, a wrong secret or a re-serialized body', () => {
		expect(verifyCampfireSignature({ ...valid, rawBody: BODY.replace('12345', '12346') })).toBe(
			false,
		);
		expect(verifyCampfireSignature({ ...valid, secret: `${TEST_KEY}x` })).toBe(false);
		expect(
			verifyCampfireSignature({ ...valid, rawBody: JSON.stringify(JSON.parse(BODY), null, 2) }),
		).toBe(false);
	});

	it('rejects deliveries older or newer than five minutes', () => {
		expect(verifyCampfireSignature({ ...valid, nowSeconds: NOW + 301 })).toBe(false);
		expect(verifyCampfireSignature({ ...valid, nowSeconds: NOW - 301 })).toBe(false);
		expect(verifyCampfireSignature({ ...valid, nowSeconds: NOW + 299 })).toBe(true);
	});

	it('rejects missing or malformed headers', () => {
		expect(verifyCampfireSignature({ ...valid, signatureHeader: undefined })).toBe(false);
		expect(verifyCampfireSignature({ ...valid, timestampHeader: undefined })).toBe(false);
		expect(verifyCampfireSignature({ ...valid, timestampHeader: 'yesterday' })).toBe(false);
		expect(verifyCampfireSignature({ ...valid, signatureHeader: 'not-hex' })).toBe(false);
	});
});
