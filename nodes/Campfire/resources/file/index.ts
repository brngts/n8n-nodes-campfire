import type { INodeProperties } from 'n8n-workflow';
import {
	binaryPropertyName,
	byDisplayName,
	idField,
	lastModifiedFilters,
	paginationProperties,
	queryOption,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { downloadFromTemporaryUrl, parseJsonResponse } from '../../shared/postReceive';
import { sendBinaryFile } from '../../shared/preSend';

const RESOURCE = 'file';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const fileGetManyQueryParameters = [
	'include_deleted',
	'last_modified_at__gte',
	'last_modified_at__lte',
];

/** Record types Campfire accepts in the upload's `model` parameter. */
const ATTACHABLE_RECORDS = [
	{ name: 'Bill', value: 'bill' },
	{ name: 'Contract', value: 'contract' },
	{ name: 'Credit Memo', value: 'credit_memo' },
	{ name: 'Customer', value: 'customer' },
	{ name: 'Debit Memo', value: 'debit_memo' },
	{ name: 'Fixed Asset', value: 'fixed_asset' },
	{ name: 'Intercompany Journal Entry', value: 'intercompany_journal' },
	{ name: 'Invoice', value: 'invoice' },
	{ name: 'Journal Entry', value: 'journal_entry' },
	{ name: 'Lease', value: 'lease_v2' },
	{ name: 'Reconciliation', value: 'reconciliation' },
	{ name: 'Revenue Contract', value: 'revenue_contract' },
];

export const fileDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Delete',
				value: 'delete',
				action: 'Delete a file',
				description: 'Delete an uploaded file',
				method: 'DELETE',
				url: '=/ca/api/file/{{$parameter.fileId}}',
				output: 'success',
			}),
			operation({
				name: 'Download',
				value: 'download',
				action: 'Download a file',
				description: 'Download a file as binary data',
				method: 'GET',
				url: '=/ca/api/file/{{$parameter.fileId}}/temp-download-url',
				output: [downloadFromTemporaryUrl],
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a file',
				description: 'Get the details of a file, such as the record it is attached to',
				method: 'GET',
				url: '=/ca/api/file/{{$parameter.fileId}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many files',
				description: 'List files with the record each one is attached to',
				method: 'GET',
				url: '/ca/api/file',
				output: 'list',
			}),
			operation({
				name: 'Upload',
				value: 'upload',
				action: 'Upload a file',
				description:
					'Upload a file and attach it to a bill, invoice, journal entry or other record',
				method: 'POST',
				url: '/ca/api/file/upload',
				output: [parseJsonResponse],
			}),
		],
		'upload',
	),
	idField('fileId', 'File ID', show(['delete', 'download', 'get']), 'The numeric ID of the file'),

	// Upload
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint: 'The name of the input binary field holding the file to upload',
		displayOptions: show(['upload']),
		routing: { send: { preSend: [sendBinaryFile] } },
	},
	{
		displayName: 'Attach To',
		name: 'model',
		type: 'options',
		options: ATTACHABLE_RECORDS,
		default: 'bill',
		required: true,
		description: 'Type of record the file belongs to',
		displayOptions: show(['upload']),
		routing: { send: { type: 'query', property: 'model' } },
	},
	{
		displayName: 'Record ID',
		name: 'objectId',
		type: 'string',
		default: '',
		placeholder: 'e.g. 12345',
		description:
			'ID of the record to attach the file to. Leave empty to upload the file without attaching it.',
		displayOptions: show(['upload']),
		routing: {
			send: {
				type: 'query',
				property: 'object_id',
				value: '={{ $value === "" ? undefined : $value }}',
			},
		},
	},
	{
		displayName: 'Options',
		name: 'uploadOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['upload']),
		options: [
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				description: 'Name to store the file under. Defaults to the name of the binary file.',
			},
		],
	},

	// Download
	binaryPropertyName(show(['download']), 'The name of the output binary field to put the file in'),

	// Get Many
	...paginationProperties(show(['getAll']), fileGetManyQueryParameters),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			queryOption({
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to also return deleted files',
			}),
			...lastModifiedFilters(),
		].sort(byDisplayName),
	},
];
