import type { INodeProperties } from 'n8n-workflow';
import {
	bodyDateOption,
	bodyIdOption,
	bodyOption,
	byDisplayName,
	deleteOptions,
	jsonBodyProperty,
	lastModifiedFilters,
	paginationProperties,
	queryDateOption,
	queryOption,
	recordBodyLocator,
	recordLocator,
	requiredDate,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { paymentProperties } from '../../shared/payment';
import { sendLines, sendSearchList, type LineField } from '../../shared/preSend';

const RESOURCE = 'bill';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const billGetManyQueryParameters = [
	'currency',
	'end_date',
	'entity',
	'include_deleted',
	'last_modified_at__gte',
	'last_modified_at__lte',
	'q',
	'sort',
	'start_date',
	'status',
	'vendor',
];

export const BILL_LINE_FIELDS: Record<string, LineField> = {
	account: { api: 'account', kind: 'id' },
	amount: { api: 'amount' },
	description: { api: 'description' },
	department: { api: 'department', kind: 'id' },
	tax: { api: 'tax' },
	taxRate: { api: 'tax_rate', kind: 'id' },
};

const billLines = (operations: string[], required: boolean): INodeProperties => ({
	displayName: 'Lines',
	name: 'lines',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Line',
	default: {},
	required,
	description: required
		? 'Expense lines of the bill. Each line books its amount to an expense account. Lines can also be sent as "lines" in the JSON field.'
		: 'Replaces every line of the bill. Leave empty to keep the current lines.',
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
					description: 'ID of the expense account the line books to',
				},
				{
					displayName: 'Amount',
					name: 'amount',
					type: 'number',
					typeOptions: { numberPrecision: 2 },
					default: 0,
					description: 'Line amount in the bill currency, in major units (12.50)',
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
			preSend: [sendLines('lines.line', 'lines', BILL_LINE_FIELDS)],
		},
	},
});

const billFields = (): INodeProperties[] =>
	[
		bodyIdOption(
			'AP Account ID',
			'ap_account',
			'Accounts payable account. Defaults to the entity AP account.',
		),
		bodyOption({
			displayName: 'Bill Type',
			name: 'bill_type',
			type: 'options',
			options: [
				{ name: 'Bill', value: 'BILL' },
				{ name: 'Payroll', value: 'PAYROLL' },
				{ name: 'Reimbursement', value: 'REIMBURSEMENT' },
			],
			default: 'BILL',
		}),
		bodyOption({
			displayName: 'Currency',
			name: 'currency',
			type: 'string',
			default: '',
			placeholder: 'e.g. EUR',
			description: 'ISO currency code. Defaults to the entity currency.',
		}),
		bodyOption({
			displayName: 'Exchange Rate',
			name: 'exchange_rate_book',
			type: 'number',
			typeOptions: { numberPrecision: 6 },
			default: 1,
			description:
				'Rate from the bill currency to the entity currency. Campfire computes it when left out.',
		}),
		bodyOption({
			displayName: 'Mailing Address',
			name: 'mailing_address',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Message on Bill',
			name: 'message_on_bill',
			type: 'string',
			default: '',
		}),
		bodyIdOption('Payment Term ID', 'payment_term'),
		bodyOption({
			displayName: 'Source',
			name: 'source',
			type: 'string',
			default: '',
			placeholder: 'e.g. n8n',
			description: 'Name of the system the bill came from',
		}),
		bodyOption({
			displayName: 'Source ID',
			name: 'source_id',
			type: 'string',
			default: '',
			description: 'ID of the bill in the source system, for tracing it back',
		}),
		bodyIdOption('Tax Rate ID', 'tax_rate'),
	].sort(byDisplayName);

export const billDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Create',
				value: 'create',
				action: 'Create a bill',
				description: 'Create a vendor bill. Campfire posts its journal entry right away.',
				method: 'POST',
				url: '/coa/api/v1/bill',
			}),
			operation({
				name: 'Delete',
				value: 'delete',
				action: 'Delete a bill',
				description: 'Delete a bill and its journal entry',
				method: 'POST',
				url: '=/coa/api/v1/bill/{{$parameter.bill}}/delete',
				output: 'success',
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a bill',
				description: 'Get a bill by ID',
				method: 'GET',
				url: '=/coa/api/v1/bill/{{$parameter.bill}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many bills',
				description: 'List bills',
				method: 'GET',
				url: '/coa/api/v1/bill',
				output: 'list',
			}),
			operation({
				name: 'Mark as Paid',
				value: 'pay',
				action: 'Mark a bill as paid',
				description: 'Record a payment against a bill from a cash or clearing account',
				method: 'POST',
				url: '=/coa/api/v1/bill/{{$parameter.bill}}/pay',
			}),
			operation({
				name: 'Reopen',
				value: 'reopen',
				action: 'Reopen a bill',
				description: 'Reopen a voided bill',
				method: 'POST',
				url: '=/coa/api/v1/bill/{{$parameter.bill}}/reopen',
			}),
			operation({
				name: 'Search by Number',
				value: 'search',
				action: 'Search bills by number',
				description: 'Find bills by their bill numbers, up to 10,000 in one request',
				method: 'POST',
				url: '/coa/api/v1/bill/bulk-search',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update a bill',
				description: 'Change fields of a bill',
				method: 'PATCH',
				url: '=/coa/api/v1/bill/{{$parameter.bill}}',
			}),
			operation({
				name: 'Void',
				value: 'void',
				action: 'Void a bill',
				description: 'Void a bill, reversing its journal entry on the void date',
				method: 'POST',
				url: '=/coa/api/v1/bill/{{$parameter.bill}}/void',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'bill',
		displayName: 'Bill',
		searchListMethod: 'getBills',
		displayOptions: show(['delete', 'get', 'pay', 'reopen', 'update', 'void']),
	}),

	// Create
	recordBodyLocator({
		name: 'vendor',
		displayName: 'Vendor',
		searchListMethod: 'getVendors',
		bodyProperty: 'vendor',
		displayOptions: show(['create']),
		description: 'The vendor who sent the bill',
	}),
	recordBodyLocator({
		name: 'entity',
		displayName: 'Entity',
		searchListMethod: 'getEntities',
		bodyProperty: 'entity',
		displayOptions: show(['create']),
		description: 'The legal entity the bill is booked in',
	}),
	{
		displayName: 'Bill Number',
		name: 'billNumber',
		type: 'string',
		default: '',
		required: true,
		description:
			'Unique per vendor. Creating the same number for the same vendor twice fails, so a fixed number makes retries safe.',
		displayOptions: show(['create']),
		routing: { send: { type: 'body', property: 'bill_number' } },
	},
	requiredDate('Bill Date', 'billDate', 'bill_date', show(['create'])),
	requiredDate('Due Date', 'dueDate', 'due_date', show(['create'])),
	billLines(['create'], true),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: billFields(),
	},
	jsonBodyProperty(
		show(['create']),
		'Other bill fields from the Campfire API reference, such as "terms" or "item_date"',
		'{"item_date": "2026-10-01"}',
	),

	// Update
	billLines(['update'], false),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [
			...billFields(),
			bodyDateOption('Bill Date', 'bill_date'),
			bodyOption({ displayName: 'Bill Number', name: 'bill_number', type: 'string', default: '' }),
			bodyDateOption('Due Date', 'due_date'),
			bodyIdOption('Vendor ID', 'vendor'),
		].sort(byDisplayName),
	},
	jsonBodyProperty(show(['update']), 'Other bill fields to change', '{"terms": "net_30"}'),

	// Mark as Paid
	...paymentProperties(show(['pay']), 'bill'),

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

	// Search by Number
	{
		displayName: 'Bill Numbers',
		name: 'billNumbers',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		placeholder: 'e.g. INV-1001, INV-1002',
		description: 'Bill numbers to look up, separated by commas or new lines',
		displayOptions: show(['search']),
		routing: { send: { preSend: [sendSearchList('billNumbers', 'bills', 'bill_number')] } },
	},

	// Get Many
	...paginationProperties(show(['getAll']), billGetManyQueryParameters),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			queryOption({
				displayName: 'Currency',
				name: 'currency',
				type: 'string',
				default: '',
				placeholder: 'e.g. EUR',
			}),
			queryOption({ displayName: 'Entity ID', name: 'entity', type: 'string', default: '' }),
			queryDateOption('From Date', 'start_date', 'Only bills dated on or after this day'),
			queryOption({
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to also return deleted bills',
			}),
			...lastModifiedFilters(),
			queryOption({
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search over bill number, vendor and memo',
			}),
			queryOption({
				displayName: 'Sort',
				name: 'sort',
				type: 'string',
				default: '',
				placeholder: 'e.g. -bill_date',
				description: 'Field to sort by. Prefix with "-" for descending.',
			}),
			queryOption({
				displayName: 'Status',
				name: 'status',
				type: 'string',
				default: '',
				placeholder: 'e.g. open',
			}),
			queryDateOption('To Date', 'end_date', 'Only bills dated on or before this day'),
			queryOption({ displayName: 'Vendor ID', name: 'vendor', type: 'string', default: '' }),
		].sort(byDisplayName),
	},
];
