import { NodeApiError, type INode, type JsonObject } from 'n8n-workflow';

/** Hints shown under Campfire's own message for the errors users run into most. */
export const DESCRIPTIONS_BY_STATUS: Record<number, string> = {
	400: 'Campfire rejected the request. Check the values against the Campfire API reference. Amounts are in major units (12.50, not 1250). Bills and invoices must have a unique number per vendor or customer, so a retried create fails here instead of making a duplicate.',
	401: 'Check that the API key is valid and has not been revoked. Keys only work in the Campfire workspace they were created in.',
	403: "The API user's role does not allow this action. View-only users can only read, and managing webhooks needs an admin user.",
	404: 'Check the ID. Campfire IDs are numbers and only exist in the workspace they were created in.',
	429: 'Campfire allows 10 requests per second per API user. Use the batching settings under the node options to space requests out.',
	500: 'Campfire failed to process the request. If it keeps happening with the same input, the payload may be missing a field Campfire expects.',
	503: 'Campfire is temporarily unavailable. Retry the request later, for example with "Retry On Fail" in the node settings.',
};

function parseBody(body: unknown): unknown {
	if (Buffer.isBuffer(body) || body instanceof ArrayBuffer) {
		body = Buffer.from(body as ArrayBuffer).toString('utf8');
	}
	if (typeof body === 'string') {
		try {
			return JSON.parse(body);
		} catch {
			return body;
		}
	}
	return body;
}

/** Field errors come back as `{ field: ["message"] }`, nested for line items. */
function fieldMessages(value: unknown, path: string, depth = 0): string[] {
	if (depth > 4 || value === null || value === undefined) return [];
	if (typeof value === 'string') return [path ? `${path}: ${value}` : value];
	if (Array.isArray(value)) {
		return value.flatMap((entry, index) =>
			typeof entry === 'string'
				? fieldMessages(entry, path, depth + 1)
				: fieldMessages(entry, path ? `${path}[${index}]` : String(index), depth + 1),
		);
	}
	if (typeof value === 'object') {
		return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
			const childPath = key === 'non_field_errors' ? path : path ? `${path}.${key}` : key;
			return fieldMessages(child, childPath, depth + 1);
		});
	}
	return [];
}

/**
 * Campfire answers errors in three shapes: `{ detail }` from the framework,
 * `{ error, errors: [] }` from its own handlers, and `{ field: [messages] }`
 * for validation errors. Download endpoints return the error as a raw buffer,
 * so the body is parsed first.
 */
export function readApiMessage(rawBody: unknown): string | undefined {
	const body = parseBody(rawBody);
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
	const { detail, error, errors, message, ...rest } = body as Record<string, unknown>;
	const parts: string[] = [];
	for (const candidate of [detail, message, error]) {
		if (typeof candidate === 'string' && candidate !== '') parts.push(candidate);
	}
	if (Array.isArray(errors)) {
		for (const entry of errors) {
			if (typeof entry === 'string' && !parts.includes(entry)) parts.push(entry);
		}
	}
	if (parts.length === 0) parts.push(...fieldMessages(rest, ''));
	const text = parts.filter(Boolean).join(' ');
	return text.length > 0 ? text : undefined;
}

function readStatusCode(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null) return undefined;
	const candidates: unknown[] = [];
	if ('httpCode' in error) candidates.push(error.httpCode);
	if ('statusCode' in error) candidates.push(error.statusCode);
	if ('cause' in error && typeof error.cause === 'object' && error.cause !== null) {
		const cause = error.cause as Record<string, unknown>;
		candidates.push(cause.statusCode, cause.httpCode);
		if (typeof cause.response === 'object' && cause.response !== null) {
			candidates.push((cause.response as Record<string, unknown>).status);
		}
	}
	for (const candidate of candidates) {
		const parsed = Number(candidate);
		if (Number.isInteger(parsed) && parsed >= 100 && parsed <= 599) return parsed;
	}
	return undefined;
}

/** Finds Campfire's message in an error thrown by `httpRequestWithAuthentication`. */
function readCampfireMessage(error: unknown): string | undefined {
	if (typeof error !== 'object' || error === null) return undefined;
	if ('cause' in error && typeof error.cause === 'object' && error.cause !== null) {
		const cause = error.cause as Record<string, unknown>;
		const response = cause.response as Record<string, unknown> | undefined;
		const fromResponse =
			readApiMessage(response?.data) ??
			readApiMessage(response?.body) ??
			readApiMessage(cause.error) ??
			readApiMessage(cause);
		if (fromResponse) return fromResponse;
	}
	if ('description' in error && typeof error.description === 'string' && error.description !== '') {
		return error.description;
	}
	return undefined;
}

/**
 * Rethrows a failed request from the trigger, list search or a preSend lookup
 * as an error that leads with Campfire's own message instead of n8n's generic one.
 */
export function toCampfireError(node: INode, error: unknown): NodeApiError {
	if (error instanceof NodeApiError && error.context.campfireHandled === true) {
		return error;
	}
	const statusCode = readStatusCode(error);
	const apiMessage = readCampfireMessage(error);
	const fallback = error instanceof Error ? error.message : String(error);
	const errorBody: JsonObject = {
		statusCode: statusCode ?? null,
		message: apiMessage ?? fallback,
	};
	const wrapped = new NodeApiError(node, errorBody, {
		message: apiMessage ?? fallback,
		description: statusCode === undefined ? undefined : DESCRIPTIONS_BY_STATUS[statusCode],
		httpCode: statusCode === undefined ? undefined : String(statusCode),
	});
	wrapped.context.campfireHandled = true;
	return wrapped;
}
