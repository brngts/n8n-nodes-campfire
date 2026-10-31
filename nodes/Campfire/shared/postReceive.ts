import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
	type JsonObject,
	type PostReceiveAction,
} from 'n8n-workflow';
import { DESCRIPTIONS_BY_STATUS, readApiMessage } from './errors';

/**
 * Identifier parameters, in the order they should be reported. Only one or two
 * of these are on screen for any given operation.
 */
const IDENTIFIER_PARAMETERS = [
	'subscriptionId',
	'journalEntryId',
	'fileId',
	'account',
	'bill',
	'contract',
	'creditMemo',
	'department',
	'dimension',
	'entity',
	'invoice',
	'payee',
	'product',
] as const;

function findIdentifier(context: IExecuteSingleFunctions): string | undefined {
	const { parameters } = context.getNode();
	for (const parameter of IDENTIFIER_PARAMETERS) {
		// `extractValue` throws for parameters the current operation does not define
		if (!(parameter in parameters)) continue;
		const value = context.getNodeParameter(parameter, '', { extractValue: true });
		if ((typeof value === 'string' && value !== '') || typeof value === 'number') {
			return String(value);
		}
	}
	return undefined;
}

/**
 * Turns Campfire's error bodies into readable errors. Requests using this
 * handler must set `ignoreHttpStatusErrors: true`, otherwise n8n throws its
 * generic error before this function runs.
 */
export async function handleCampfireError(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	if (response.statusCode < 400) {
		return items;
	}

	const apiMessage = readApiMessage(response.body);
	const errorBody: JsonObject = {
		statusCode: response.statusCode,
		message: apiMessage ?? null,
	};

	const identifier = response.statusCode === 404 ? findIdentifier(this) : undefined;

	// Naming the identifier is more useful than a generic "not found", so it
	// takes over the message and the API's own wording moves into the description.
	throw new NodeApiError(this.getNode(), errorBody, {
		message: identifier
			? `Campfire could not find "${identifier}"`
			: (apiMessage ?? `Campfire request failed with status ${response.statusCode}`),
		description:
			[identifier ? apiMessage : undefined, DESCRIPTIONS_BY_STATUS[response.statusCode]]
				.filter(Boolean)
				.join(' ') || undefined,
		httpCode: String(response.statusCode),
	});
}

/**
 * Deletes answer 204 with no body. When an approval workflow holds the delete
 * back, Campfire answers 202 with the pending draft instead, which is passed on.
 */
export async function returnSuccess(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const hasContent = items.some(
		(item) =>
			typeof item.json === 'object' && item.json !== null && Object.keys(item.json).length > 0,
	);
	if (response.statusCode === 202) {
		return hasContent
			? items.map((item) => ({ json: { pendingApproval: true, ...item.json } }))
			: [{ json: { success: true, pendingApproval: true } }];
	}
	return hasContent ? items : [{ json: { success: true } }];
}

/** Requests sent with `json: false`, such as uploads, come back as text. */
export async function parseJsonResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const { body } = response;
	const text = Buffer.isBuffer(body)
		? body.toString('utf8')
		: typeof body === 'string'
			? body
			: undefined;
	if (text === undefined) return items;
	if (text.trim() === '') return [{ json: { success: true } }];
	try {
		const parsed: unknown = JSON.parse(text);
		if (Array.isArray(parsed)) return parsed.map((entry) => ({ json: entry as IDataObject }));
		return [{ json: parsed as IDataObject }];
	} catch {
		return [{ json: { response: text } }];
	}
}

function toBuffer(body: unknown): Buffer {
	if (Buffer.isBuffer(body)) return body;
	if (typeof body === 'string') return Buffer.from(body, 'binary');
	return Buffer.from(body as ArrayBuffer);
}

/** Turns a PDF download into a binary item named after the record it belongs to. */
export function pdfToBinary(fileNamePrefix: string, idParameter: string): PostReceiveAction {
	return async function (
		this: IExecuteSingleFunctions,
		_items: INodeExecutionData[],
		response: IN8nHttpFullResponse,
	): Promise<INodeExecutionData[]> {
		const id = String(this.getNodeParameter(idParameter, '', { extractValue: true }));
		const binaryPropertyName = String(this.getNodeParameter('binaryPropertyName', 'data'));
		const fileName = `${fileNamePrefix}-${id}.pdf`;
		const binaryData = await this.helpers.prepareBinaryData(
			toBuffer(response.body),
			fileName,
			'application/pdf',
		);
		return [
			{
				json: { id, fileName },
				binary: { [binaryPropertyName]: binaryData },
			},
		];
	};
}

/**
 * File download answers with a short-lived presigned URL. The file itself is
 * fetched from that URL without the Campfire credential, since the URL is
 * already signed.
 */
export async function downloadFromTemporaryUrl(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const url = items[0]?.json?.url;
	if (typeof url !== 'string' || url === '') {
		throw new NodeOperationError(
			this.getNode(),
			'Campfire did not return a download URL for this file',
		);
	}
	const fileId = String(this.getNodeParameter('fileId', ''));
	const binaryPropertyName = String(this.getNodeParameter('binaryPropertyName', 'data'));

	const file = await this.helpers.httpRequest({
		method: 'GET',
		url,
		encoding: 'arraybuffer',
		returnFullResponse: true,
		json: false,
	});

	const pathName = url.split('?')[0];
	const fileName =
		decodeURIComponent(pathName.substring(pathName.lastIndexOf('/') + 1)) || `file-${fileId}`;
	const headers = (file.headers ?? {}) as Record<string, unknown>;
	const contentType =
		typeof headers['content-type'] === 'string' ? headers['content-type'] : undefined;

	const binaryData = await this.helpers.prepareBinaryData(
		toBuffer(file.body),
		fileName,
		contentType,
	);
	return [
		{
			json: { id: fileId, fileName },
			binary: { [binaryPropertyName]: binaryData },
		},
	];
}
