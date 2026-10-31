import { describe, expect, it } from 'vitest';
import { selectedTopics } from '../nodes/CampfireTrigger/CampfireTrigger.node';
import { WEBHOOK_TOPICS } from '../nodes/CampfireTrigger/events';
import { BILL_LINE_FIELDS } from '../nodes/Campfire/resources/bill';
import { readApiMessage } from '../nodes/Campfire/shared/errors';
import { offsetPagination } from '../nodes/Campfire/shared/pagination';
import { multipartBody, parseIds, toLine } from '../nodes/Campfire/shared/preSend';

describe('toLine', () => {
	it('maps form fields to API names, converts IDs and drops empty fields', () => {
		expect(
			toLine(
				{ account: '180564', amount: 120.5, description: '', department: '3613', taxRate: '' },
				BILL_LINE_FIELDS,
			),
		).toEqual({ account: 180564, amount: 120.5, department: 3613 });
	});

	it('cuts dates to YYYY-MM-DD and splits ID lists', () => {
		expect(
			toLine(
				{ day: '2026-10-31T00:00:00.000+01:00', tags: '7737, 8330,' },
				{ day: { api: 'service_date', kind: 'date' }, tags: { api: 'tag_ids', kind: 'ids' } },
			),
		).toEqual({ service_date: '2026-10-31', tag_ids: [7737, 8330] });
		expect(parseIds('')).toEqual([]);
	});
});

describe('readApiMessage', () => {
	it('reads the three error shapes Campfire uses', () => {
		expect(readApiMessage({ detail: 'Not found.' })).toBe('Not found.');
		expect(
			readApiMessage({
				error: 'Accounting bill with this Customer, Vendor and Bill number already exists.',
				errors: ['Accounting bill with this Customer, Vendor and Bill number already exists.'],
			}),
		).toBe('Accounting bill with this Customer, Vendor and Bill number already exists.');
		expect(
			readApiMessage({
				bill_date: ['This field is required.'],
				lines: [{ account: ['Invalid pk.'] }],
			}),
		).toBe('bill_date: This field is required. lines[0].account: Invalid pk.');
		expect(readApiMessage({ non_field_errors: ['Debits must equal credits.'] })).toBe(
			'Debits must equal credits.',
		);
	});

	it('reads buffers and ignores non-JSON bodies', () => {
		expect(readApiMessage(Buffer.from('{"detail":"Invalid token."}'))).toBe('Invalid token.');
		expect(readApiMessage('<html>Server Error</html>')).toBeUndefined();
		expect(readApiMessage('')).toBeUndefined();
	});
});

describe('offsetPagination', () => {
	it('carries filters over and starts from offset 0', () => {
		const { qs } = offsetPagination(['status', 'vendor']).properties.request;
		expect(qs).toMatchObject({
			status: '={{ $request.qs?.status }}',
			vendor: '={{ $request.qs?.vendor }}',
			limit: 100,
		});
		expect(String(qs?.offset)).toContain(': 0');
		expect(offsetPagination([]).properties.continue).toContain('next');
	});
});

describe('multipartBody', () => {
	it('wraps the file in a single form-data part', () => {
		const { body, contentType } = multipartBody(
			'file',
			'receipt "1".pdf',
			'application/pdf',
			Buffer.from('%PDF'),
			'B',
		);
		expect(contentType).toBe('multipart/form-data; boundary=B');
		expect(body.toString()).toBe(
			'--B\r\nContent-Disposition: form-data; name="file"; filename="receipt _1_.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF\r\n--B--\r\n',
		);
	});
});

describe('selectedTopics', () => {
	it('expands All Topics to every known topic', () => {
		expect(selectedTopics(['*'])).toHaveLength(WEBHOOK_TOPICS.length);
		expect(selectedTopics([])).toHaveLength(WEBHOOK_TOPICS.length);
	});

	it('dedupes and sorts an explicit selection', () => {
		expect(selectedTopics(['Invoice.paid', 'Bill.created', 'Invoice.paid'])).toEqual([
			'Bill.created',
			'Invoice.paid',
		]);
	});
});
