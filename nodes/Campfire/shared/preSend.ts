import { randomBytes } from 'node:crypto';
import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
} from 'n8n-workflow';
import { campfireApiRequest } from './transport';

function parseJsonObject(
	context: IExecuteSingleFunctions,
	value: unknown,
	label: string,
): IDataObject {
	if (value === undefined || value === null || value === '') return {};
	let parsed: unknown = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value);
		} catch {
			throw new NodeOperationError(context.getNode(), `${label} is not valid JSON`, {
				description: 'Check for missing quotes, trailing commas or unescaped characters.',
			});
		}
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new NodeOperationError(context.getNode(), `${label} must be a JSON object`, {
			description: 'Wrap the fields in curly braces, for example {"memo": "Accrual"}.',
		});
	}
	return parsed as IDataObject;
}

function withBody(requestOptions: IHttpRequestOptions, fields: IDataObject): IHttpRequestOptions {
	requestOptions.body = { ...((requestOptions.body ?? {}) as IDataObject), ...fields };
	return requestOptions;
}

/**
 * Merges a JSON parameter into the request body, for the nested structures
 * (intercompany entities, revenue transactions, custom fields) that do not fit
 * a flat form. Fields set through the node's own parameters win over the same
 * key in the JSON.
 */
export function mergeJsonBody(parameterName: string, label: string) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const extra = parseJsonObject(this, this.getNodeParameter(parameterName, '{}'), label);
		const body = (requestOptions.body ?? {}) as IDataObject;
		requestOptions.body = { ...extra, ...body };
		return requestOptions;
	};
}

/** How one form field of a line row maps to the API: its name, and whether it holds an ID or a date. */
export type LineField = { api: string; kind?: 'id' | 'ids' | 'date' };

/** Reads "12, 34" or [12, 34] as a list of integer IDs. */
export function parseIds(value: unknown): number[] {
	const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
	return parts
		.map((id) => String(id).trim())
		.filter((id) => id !== '')
		.map(Number);
}

/** Maps one form row to Campfire's line shape, leaving out fields the user left empty. */
export function toLine(row: IDataObject, fields: Record<string, LineField>): IDataObject {
	const line: IDataObject = {};
	for (const [key, { api, kind }] of Object.entries(fields)) {
		const value = row[key];
		if (value === undefined || value === null || value === '') continue;
		if (kind === 'id') line[api] = Number(value);
		else if (kind === 'ids') {
			const ids = parseIds(value);
			if (ids.length > 0) line[api] = ids;
		} else if (kind === 'date') line[api] = String(value).slice(0, 10);
		else line[api] = value;
	}
	return line;
}

/**
 * Sends the rows of a fixed collection as an array body field, such as a bill's
 * `lines`. When no rows are set, the body is left alone so the lines can come
 * from the JSON field instead.
 */
export function sendLines(
	collectionPath: string,
	bodyProperty: string,
	fields: Record<string, LineField>,
) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const rows = this.getNodeParameter(collectionPath, []) as IDataObject[];
		if (rows.length === 0) return requestOptions;
		return withBody(requestOptions, { [bodyProperty]: rows.map((row) => toLine(row, fields)) });
	};
}

/**
 * Journal entry lines carry one amount and a direction. Campfire wants it as
 * `debit_amount_native` or `credit_amount_native`, never both.
 */
export async function sendJournalLines(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const rows = this.getNodeParameter('lines.line', []) as IDataObject[];
	if (rows.length === 0) return requestOptions;
	const transactions = rows.map((row) => {
		const line = toLine(row, {
			account: { api: 'account', kind: 'id' },
			description: { api: 'bank_description' },
			department: { api: 'department', kind: 'id' },
			payee: { api: 'vendor', kind: 'id' },
			entity: { api: 'entity', kind: 'id' },
		});
		const amount = Number(row.amount ?? 0);
		line[row.side === 'credit' ? 'credit_amount_native' : 'debit_amount_native'] = amount;
		const tagIds = parseIds(row.dimensions);
		if (tagIds.length > 0) line.tags = tagIds.map((id) => ({ id }));
		return line;
	});
	return withBody(requestOptions, { transactions });
}

/**
 * Records a payment made outside a bank feed match. Campfire requires the
 * payment account's name next to its ID, so the name is looked up first.
 */
export async function sendManualPayment(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const accountId = Number(this.getNodeParameter('paymentAccount', '', { extractValue: true }));
	const account = (await campfireApiRequest.call(
		this,
		'GET',
		`/coa/api/account/${accountId}`,
	)) as IDataObject;
	const options = this.getNodeParameter('paymentOptions', {}) as IDataObject;

	const payment: IDataObject = {
		account_id: accountId,
		account_name: String(account.name ?? ''),
		amount: this.getNodeParameter('amount') as number,
		payment_date: String(this.getNodeParameter('paymentDate')).slice(0, 10),
		...toLine(options, {
			currency: { api: 'currency' },
			department: { api: 'department_id', kind: 'id' },
			externalId: { api: 'external_id' },
			memo: { api: 'memo' },
			dimensions: { api: 'tag_ids', kind: 'ids' },
		}),
	};
	return withBody(requestOptions, { empty_transactions: [payment] });
}

/**
 * Turns a comma or line separated list into `[{ [key]: value }]` for the bulk
 * search endpoints. `itemFields` adds the value of other node parameters to
 * every entry, and `upsertParameter` sends `upsert` from a boolean parameter.
 */
export function sendSearchList(
	parameterName: string,
	bodyProperty: string,
	key: string,
	itemFields: Record<string, string> = {},
	upsertParameter?: string,
) {
	return async function (
		this: IExecuteSingleFunctions,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const values = String(this.getNodeParameter(parameterName, ''))
			.split(/[\n,]/)
			.map((value) => value.trim())
			.filter((value) => value !== '');
		if (values.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Enter at least one value to search for');
		}
		const extras: IDataObject = {};
		for (const [apiName, nodeParameter] of Object.entries(itemFields)) {
			const value = this.getNodeParameter(nodeParameter, '');
			if (value !== '' && value !== undefined && value !== null) extras[apiName] = value;
		}
		const fields: IDataObject = {
			[bodyProperty]: values.map((value) => ({ [key]: value, ...extras })),
		};
		if (upsertParameter) fields.upsert = this.getNodeParameter(upsertParameter, false) as boolean;
		return withBody(requestOptions, fields);
	};
}

/** Builds a multipart/form-data body by hand, so the package needs no form-data dependency. */
export function multipartBody(
	fieldName: string,
	fileName: string,
	contentType: string,
	data: Buffer,
	boundary = `----n8nCampfire${randomBytes(12).toString('hex')}`,
): { body: Buffer; contentType: string } {
	const safeName = fileName.replace(/["\r\n]/g, '_');
	const head = Buffer.from(
		`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${safeName}"\r\nContent-Type: ${contentType}\r\n\r\n`,
	);
	const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
	return {
		body: Buffer.concat([head, data, tail]),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

/** Sends the input item's binary file as the `file` part of a multipart upload. */
export async function sendBinaryFile(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const binaryPropertyName = String(this.getNodeParameter('binaryPropertyName', 'data'));
	const binaryData = this.helpers.assertBinaryData(binaryPropertyName);
	const data = await this.helpers.getBinaryDataBuffer(binaryPropertyName);
	const options = this.getNodeParameter('uploadOptions', {}) as IDataObject;
	const fileName =
		typeof options.fileName === 'string' && options.fileName !== ''
			? options.fileName
			: (binaryData.fileName ?? 'file');

	const multipart = multipartBody(
		'file',
		fileName,
		binaryData.mimeType || 'application/octet-stream',
		data,
	);
	requestOptions.body = multipart.body;
	requestOptions.json = false;
	requestOptions.headers = {
		...(requestOptions.headers ?? {}),
		'Content-Type': multipart.contentType,
		Accept: 'application/json',
	};
	return requestOptions;
}
