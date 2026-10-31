import { createHmac, timingSafeEqual } from 'node:crypto';

/** Deliveries further than this from the current time are treated as replays, as Campfire recommends. */
export const MAX_TIMESTAMP_AGE_SECONDS = 300;

type VerifyOptions = {
	secret: string;
	rawBody: Buffer | string;
	timestampHeader: unknown;
	signatureHeader: unknown;
	/** Current time in seconds, injectable for tests */
	nowSeconds?: number;
};

/**
 * Verifies a Campfire webhook delivery. Campfire signs `${timestamp}:${rawBody}`
 * with HMAC-SHA256, keyed with the webhook's secret, and sends the hex digest in
 * `Campfire-Webhook-Signature-v1`. Retries are re-signed with a fresh timestamp.
 */
export function verifyCampfireSignature({
	secret,
	rawBody,
	timestampHeader,
	signatureHeader,
	nowSeconds = Math.floor(Date.now() / 1000),
}: VerifyOptions): boolean {
	if (typeof timestampHeader !== 'string' || typeof signatureHeader !== 'string') return false;

	const timestamp = Number(timestampHeader);
	if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_TIMESTAMP_AGE_SECONDS) {
		return false;
	}

	const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
	const expected = createHmac('sha256', secret).update(`${timestampHeader}:`).update(body).digest();
	const actual = Buffer.from(signatureHeader.trim().toLowerCase(), 'hex');
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}
