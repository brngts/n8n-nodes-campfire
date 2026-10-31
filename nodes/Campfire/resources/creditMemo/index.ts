import type { INodeProperties } from 'n8n-workflow';
import {
	binaryPropertyName,
	bodyDateOption,
	bodyIdOption,
	bodyOption,
	byDisplayName,
	deleteOptions,
	jsonBodyProperty,
	paginationProperties,
	queryDateOption,
	queryOption,
	recordBodyLocator,
	recordLocator,
	requiredDate,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { pdfToBinary } from '../../shared/postReceive';
import { sendLines, type LineField } from '../../shared/preSend';

const RESOURCE = 'creditMemo';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const creditMemoGetManyQueryParameters = [
	'client',
	'contract',
	'end_date',
	'entity',
	'q',
	'sort',
	'start_date',
	'status',
];

export const CREDIT_MEMO_LINE_FIELDS: Record<string, LineField> = {
	account: { api: 'account', kind: 'id' },
	amount: { api: 'amount' },
	department: { api: 'department', kind: 'id' },
	description: { api: 'description' },
	dimensions: { api: 'tag_ids', kind: 'ids' },
	product: { api: 'product', kind: 'id' },
	tax: { api: 'tax' },
	taxRate: { api: 'tax_rate', kind: 'id' },
};

const creditMemoLines = (operations: string[], required: boolean): INodeProperties => ({
	displayName: 'Lines',
	name: 'lines',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Line',
	default: {},
	required,
	description: required
		? 'Credit memo lines. Lines can also be sent as "lines" in the JSON field.'
		: 'Replaces every line of the credit memo. Leave empty to keep the current lines.',
	displayOptions: show(operations),
	options: [
		{
			displayName: 'Line',
			name: 'line',
			values: [
				{
					displayName: 'Account ID',
					name: 'account',
					type: 'string',
					default: '',
					required: true,
					placeholder: 'e.g. 180564',
					description:
						'ID of the account the credit books to, usually a revenue or contra-revenue account',
				},
				{
					displayName: 'Amount',
					name: 'amount',
					type: 'number',
					typeOptions: { numberPrecision: 2 },
					default: 0,
					description: 'Line amount in major units',
				},
				{
					displayName: 'Custom Dimension IDs',
					name: 'dimensions',
					type: 'string',
					default: '',
					placeholder: 'e.g. 7737, 8330',
					description: 'Comma-separated custom dimension (tag) IDs',
				},
				{
					displayName: 'Department ID',
					name: 'department',
					type: 'string',
					default: '',
				},
				{
					displayName: 'Description',
					name: 'description',
					type: 'string',
					default: '',
				},
				{
					displayName: 'Product ID',
					name: 'product',
					type: 'string',
					default: '',
				},
				{
					displayName: 'Tax Amount',
					name: 'tax',
					type: 'number',
					typeOptions: { numberPrecision: 2 },
					default: 0,
				},
				{
					displayName: 'Tax Rate ID',
					name: 'taxRate',
					type: 'string',
					default: '',
				},
			],
		},
	],
	routing: {
		send: {
			preSend: [sendLines('lines.line', 'lines', CREDIT_MEMO_LINE_FIELDS)],
		},
	},
});

const creditMemoFields = (): INodeProperties[] =>
	[
		bodyIdOption('Contract ID', 'contract', 'Revenue contract the credit belongs to'),
		bodyIdOption('Credit Account ID', 'credit_account'),
		bodyOption({
			displayName: 'Credit Memo Number',
			name: 'credit_memo_number',
			type: 'string',
			default: '',
			description: 'Campfire assigns the next number when left out',
		}),
		bodyOption({
			displayName: 'Credit Memo Type',
			name: 'credit_memo_type',
			type: 'options',
			options: [
				{ name: 'Credit Memo', value: 'credit_memo' },
				{ name: 'Overpayment', value: 'overpayment' },
			],
			default: 'credit_memo',
		}),
		bodyOption({
			displayName: 'Currency',
			name: 'currency',
			type: 'string',
			default: '',
			placeholder: 'e.g. EUR',
		}),
		bodyOption({
			displayName: 'Message on Credit Memo',
			name: 'message_on_credit_memo',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Reference Number',
			name: 'ref_number',
			type: 'string',
			default: '',
		}),
		bodyOption({ displayName: 'VAT Number', name: 'vat_number', type: 'string', default: '' }),
	].sort(byDisplayName);

export const creditMemoDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Create',
				value: 'create',
				action: 'Create a credit memo',
				description: 'Create a credit memo for a customer',
				method: 'POST',
				url: '/coa/api/v1/credit-memo',
			}),
			operation({
				name: 'Delete',
				value: 'delete',
				action: 'Delete a credit memo',
				description: 'Delete a credit memo',
				method: 'POST',
				url: '=/coa/api/v1/credit-memo/{{$parameter.creditMemo}}/delete',
				output: 'success',
			}),
			operation({
				name: 'Download',
				value: 'download',
				action: 'Download a credit memo',
				description: 'Download the PDF of a credit memo',
				method: 'GET',
				url: '=/coa/api/v1/credit-memo/{{$parameter.creditMemo}}/pdf',
				output: [pdfToBinary('credit-memo', 'creditMemo')],
				request: {
					encoding: 'arraybuffer',
					json: false,
					headers: { Accept: 'application/pdf' },
				},
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a credit memo',
				description: 'Get a credit memo by ID',
				method: 'GET',
				url: '=/coa/api/v1/credit-memo/{{$parameter.creditMemo}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many credit memos',
				description: 'List credit memos',
				method: 'GET',
				url: '/coa/api/v1/credit-memo',
				output: 'list',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update a credit memo',
				description: 'Change fields of a credit memo',
				method: 'PATCH',
				url: '=/coa/api/v1/credit-memo/{{$parameter.creditMemo}}',
			}),
			operation({
				name: 'Void',
				value: 'void',
				action: 'Void a credit memo',
				description: 'Void a credit memo, reversing its journal entry on the void date',
				method: 'POST',
				url: '=/coa/api/v1/credit-memo/{{$parameter.creditMemo}}/void',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'creditMemo',
		displayName: 'Credit Memo',
		searchListMethod: 'getCreditMemos',
		displayOptions: show(['delete', 'download', 'get', 'update', 'void']),
	}),

	// Create
	recordBodyLocator({
		name: 'entity',
		displayName: 'Entity',
		searchListMethod: 'getEntities',
		bodyProperty: 'entity',
		displayOptions: show(['create']),
		description: 'The legal entity issuing the credit memo',
	}),
	recordBodyLocator({
		name: 'customer',
		displayName: 'Customer',
		searchListMethod: 'getCustomers',
		bodyProperty: 'client',
		displayOptions: show(['create']),
		description: 'The customer receiving the credit',
	}),
	requiredDate('Credit Memo Date', 'creditMemoDate', 'credit_memo_date', show(['create'])),
	creditMemoLines(['create'], true),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: creditMemoFields(),
	},
	jsonBodyProperty(
		show(['create']),
		'Other credit memo fields from the Campfire API reference',
		'{"applied_date": "2026-10-31"}',
	),

	// Update
	creditMemoLines(['update'], false),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [
			...creditMemoFields(),
			bodyDateOption('Credit Memo Date', 'credit_memo_date'),
			bodyIdOption('Customer ID', 'client'),
		].sort(byDisplayName),
	},
	jsonBodyProperty(
		show(['update']),
		'Other credit memo fields to change',
		'{"ref_number": "CN-1042"}',
	),

	// Void
	requiredDate(
		'Void Date',
		'voidDate',
		'void_date',
		show(['void']),
		'Date the reversing entry is posted on',
	),

	// Delete
	deleteOptions(show(['delete'])),

	// Download
	binaryPropertyName(show(['download']), 'The name of the output binary field to put the PDF in'),

	// Get Many
	...paginationProperties(show(['getAll']), creditMemoGetManyQueryParameters),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			queryOption({ displayName: 'Contract ID', name: 'contract', type: 'string', default: '' }),
			queryOption({ displayName: 'Customer ID', name: 'client', type: 'string', default: '' }),
			queryOption({ displayName: 'Entity ID', name: 'entity', type: 'string', default: '' }),
			queryDateOption('From Date', 'start_date', 'Only credit memos dated on or after this day'),
			queryOption({ displayName: 'Search', name: 'q', type: 'string', default: '' }),
			queryOption({
				displayName: 'Sort',
				name: 'sort',
				type: 'string',
				default: '',
				placeholder: 'e.g. -credit_memo_date',
				description: 'Field to sort by. Prefix with "-" for descending.',
			}),
			queryOption({
				displayName: 'Status',
				name: 'status',
				type: 'string',
				default: '',
				placeholder: 'e.g. open',
			}),
			queryDateOption('To Date', 'end_date', 'Only credit memos dated on or before this day'),
		].sort(byDisplayName),
	},
];
