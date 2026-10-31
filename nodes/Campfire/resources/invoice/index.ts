import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import {
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
import { paymentProperties } from '../../shared/payment';
import { sendLines, type LineField } from '../../shared/preSend';

const RESOURCE = 'invoice';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const invoiceGetManyQueryParameters = [
	'client',
	'contract',
	'currency',
	'end_date',
	'entity',
	'invoice_number',
	'paid_date_from',
	'paid_date_to',
	'q',
	'ref_number',
	'sort',
	'start_date',
	'status',
];

export const PAYMENT_TERMS: INodePropertyOptions[] = [
	{ name: 'Custom', value: 'custom' },
	{ name: 'Due on Receipt', value: 'due_on_receipt' },
	{ name: 'Net 10', value: 'net_10' },
	{ name: 'Net 105', value: 'net_105' },
	{ name: 'Net 120', value: 'net_120' },
	{ name: 'Net 15', value: 'net_15' },
	{ name: 'Net 20', value: 'net_20' },
	{ name: 'Net 30', value: 'net_30' },
	{ name: 'Net 40', value: 'net_40' },
	{ name: 'Net 45', value: 'net_45' },
	{ name: 'Net 5', value: 'net_5' },
	{ name: 'Net 60', value: 'net_60' },
	{ name: 'Net 7', value: 'net_7' },
	{ name: 'Net 90', value: 'net_90' },
];

export const INVOICE_LINE_FIELDS: Record<string, LineField> = {
	amount: { api: 'amount' },
	department: { api: 'department', kind: 'id' },
	description: { api: 'description' },
	discount: { api: 'discount' },
	product: { api: 'product', kind: 'id' },
	quantity: { api: 'quantity' },
	rate: { api: 'rate' },
	serviceDate: { api: 'service_date', kind: 'date' },
	tax: { api: 'tax' },
	taxRate: { api: 'tax_rate', kind: 'id' },
};

const invoiceLines = (operations: string[], required: boolean): INodeProperties => ({
	displayName: 'Lines',
	name: 'lines',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Line',
	default: {},
	required,
	description: required
		? 'Invoice lines. Each line needs a product, which sets the revenue and receivable accounts. Lines can also be sent as "lines" in the JSON field.'
		: 'Replaces every line of the invoice. Leave empty to keep the current lines.',
	displayOptions: show(operations),
	options: [
		{
			displayName: 'Line',
			name: 'line',
			values: [
				{
					displayName: 'Amount',
					name: 'amount',
					type: 'number',
					typeOptions: { numberPrecision: 2 },
					default: 0,
					description:
						'Line total in major units. Campfire computes it from quantity and rate when left at 0.',
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
					displayName: 'Discount',
					name: 'discount',
					type: 'number',
					typeOptions: { numberPrecision: 2 },
					default: 0,
				},
				{
					displayName: 'Product ID',
					name: 'product',
					type: 'string',
					default: '',
					required: true,
					placeholder: 'e.g. 4521',
					description: 'ID of the Campfire product. Campfire rejects invoice lines without one.',
				},
				{
					displayName: 'Quantity',
					name: 'quantity',
					type: 'number',
					default: 1,
				},
				{
					displayName: 'Rate',
					name: 'rate',
					type: 'number',
					typeOptions: { numberPrecision: 2 },
					default: 0,
					description: 'Price per unit in major units',
				},
				{
					displayName: 'Service Date',
					name: 'serviceDate',
					type: 'dateTime',
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
			preSend: [sendLines('lines.line', 'lines', INVOICE_LINE_FIELDS)],
		},
	},
});

const invoiceFields = (): INodeProperties[] =>
	[
		bodyOption({
			displayName: 'Auto Send',
			name: 'auto_send_invoice',
			type: 'boolean',
			default: false,
			description: 'Whether Campfire emails the invoice to the customer',
		}),
		bodyOption({
			displayName: 'Billing Address',
			name: 'billing_address',
			type: 'string',
			default: '',
		}),
		bodyIdOption('Contract ID', 'contract', 'Revenue contract the invoice belongs to'),
		bodyOption({
			displayName: 'Currency',
			name: 'currency',
			type: 'string',
			default: '',
			placeholder: 'e.g. EUR',
			description: 'ISO currency code. Defaults to the entity currency.',
		}),
		bodyIdOption('Department ID', 'department'),
		bodyOption({
			displayName: 'Invoice Number',
			name: 'invoice_number',
			type: 'string',
			default: '',
			description:
				'Unique per customer. Campfire assigns the next number when left out. A fixed number makes retries safe, since a duplicate is rejected.',
		}),
		bodyOption({
			displayName: 'Message on Invoice',
			name: 'message_on_invoice',
			type: 'string',
			default: '',
		}),
		bodyIdOption('Payment Term ID', 'payment_term'),
		bodyDateOption('Period End', 'period_end'),
		bodyDateOption('Period Start', 'period_start'),
		bodyOption({
			displayName: 'Purchase Order Number',
			name: 'purchase_order_number',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Reference Number',
			name: 'ref_number',
			type: 'string',
			default: '',
			description: 'Your own reference, such as the invoice ID in the billing system',
		}),
		bodyOption({
			displayName: 'Shipping Address',
			name: 'shipping_address',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Tax Exempt',
			name: 'tax_exempt',
			type: 'boolean',
			default: false,
			description: 'Whether the invoice is exempt from tax',
		}),
		bodyOption({
			displayName: 'Terms',
			name: 'terms',
			type: 'options',
			options: PAYMENT_TERMS,
			default: 'net_30',
		}),
		bodyOption({ displayName: 'VAT Number', name: 'vat_number', type: 'string', default: '' }),
	].sort(byDisplayName);

export const invoiceDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Create',
				value: 'create',
				action: 'Create an invoice',
				description: 'Create a customer invoice. Campfire posts its journal entry right away.',
				method: 'POST',
				url: '/coa/api/v1/invoice',
			}),
			operation({
				name: 'Delete',
				value: 'delete',
				action: 'Delete an invoice',
				description: 'Delete an invoice and its journal entry',
				method: 'POST',
				url: '=/coa/api/v1/invoice/{{$parameter.invoice}}/delete',
				output: 'success',
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get an invoice',
				description: 'Get an invoice by ID',
				method: 'GET',
				url: '=/coa/api/v1/invoice/{{$parameter.invoice}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many invoices',
				description: 'List invoices',
				method: 'GET',
				url: '/coa/api/v1/invoice',
				output: 'list',
			}),
			operation({
				name: 'Mark as Paid',
				value: 'pay',
				action: 'Mark an invoice as paid',
				description: 'Record a customer payment against an invoice',
				method: 'POST',
				url: '=/coa/api/v1/invoice/{{$parameter.invoice}}/pay',
			}),
			operation({
				name: 'Reopen',
				value: 'reopen',
				action: 'Reopen an invoice',
				description: 'Reopen a voided invoice',
				method: 'POST',
				url: '=/coa/api/v1/invoice/{{$parameter.invoice}}/reopen',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update an invoice',
				description: 'Change fields of an invoice',
				method: 'PATCH',
				url: '=/coa/api/v1/invoice/{{$parameter.invoice}}',
			}),
			operation({
				name: 'Void',
				value: 'void',
				action: 'Void an invoice',
				description: 'Void an invoice, reversing its journal entry',
				method: 'POST',
				url: '=/coa/api/v1/invoice/{{$parameter.invoice}}/void',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'invoice',
		displayName: 'Invoice',
		searchListMethod: 'getInvoices',
		displayOptions: show(['delete', 'get', 'pay', 'reopen', 'update', 'void']),
	}),

	// Create
	recordBodyLocator({
		name: 'customer',
		displayName: 'Customer',
		searchListMethod: 'getCustomers',
		bodyProperty: 'client',
		displayOptions: show(['create']),
		description: 'The customer the invoice is addressed to',
	}),
	recordBodyLocator({
		name: 'entity',
		displayName: 'Entity',
		searchListMethod: 'getEntities',
		bodyProperty: 'entity',
		displayOptions: show(['create']),
		description: 'The legal entity issuing the invoice',
	}),
	requiredDate('Invoice Date', 'invoiceDate', 'invoice_date', show(['create'])),
	requiredDate('Due Date', 'dueDate', 'due_date', show(['create'])),
	invoiceLines(['create'], true),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: invoiceFields(),
	},
	jsonBodyProperty(
		show(['create']),
		'Other invoice fields from the Campfire API reference, such as "revenue_contract_link" to attach the invoice to a contract outside its billing schedule',
		'{"revenue_contract_link": 3247791}',
	),

	// Update
	invoiceLines(['update'], false),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [
			...invoiceFields(),
			bodyIdOption('Customer ID', 'client'),
			bodyDateOption('Due Date', 'due_date'),
			bodyDateOption('Invoice Date', 'invoice_date'),
		].sort(byDisplayName),
	},
	jsonBodyProperty(show(['update']), 'Other invoice fields to change', '{"terms": "net_30"}'),

	// Mark as Paid
	...paymentProperties(show(['pay']), 'invoice'),

	// Void
	{
		displayName: 'Options',
		name: 'voidOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['void']),
		options: [
			bodyDateOption(
				'Void Date',
				'void_date',
				'Date the reversing entry is posted on. Defaults to today.',
			),
		],
	},

	// Delete
	deleteOptions(show(['delete'])),

	// Get Many
	...paginationProperties(show(['getAll']), invoiceGetManyQueryParameters),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			queryOption({ displayName: 'Contract ID', name: 'contract', type: 'string', default: '' }),
			queryOption({
				displayName: 'Currency',
				name: 'currency',
				type: 'string',
				default: '',
				placeholder: 'e.g. EUR',
			}),
			queryOption({ displayName: 'Customer ID', name: 'client', type: 'string', default: '' }),
			queryOption({ displayName: 'Entity ID', name: 'entity', type: 'string', default: '' }),
			queryDateOption('From Date', 'start_date', 'Only invoices dated on or after this day'),
			queryOption({
				displayName: 'Invoice Number',
				name: 'invoice_number',
				type: 'string',
				default: '',
			}),
			queryDateOption('Paid From', 'paid_date_from', 'Only invoices paid on or after this day'),
			queryDateOption('Paid To', 'paid_date_to', 'Only invoices paid on or before this day'),
			queryOption({
				displayName: 'Reference Number',
				name: 'ref_number',
				type: 'string',
				default: '',
			}),
			queryOption({
				displayName: 'Search',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Free-text search over invoice number, customer and memo',
			}),
			queryOption({
				displayName: 'Sort',
				name: 'sort',
				type: 'string',
				default: '',
				placeholder: 'e.g. -invoice_date',
				description: 'Field to sort by. Prefix with "-" for descending.',
			}),
			queryOption({
				displayName: 'Status',
				name: 'status',
				type: 'string',
				default: '',
				placeholder: 'e.g. open',
			}),
			queryDateOption('To Date', 'end_date', 'Only invoices dated on or before this day'),
		].sort(byDisplayName),
	},
];
