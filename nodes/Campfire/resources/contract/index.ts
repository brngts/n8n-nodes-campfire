import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import {
	bodyDateOption,
	bodyIdOption,
	bodyOption,
	byDisplayName,
	deleteOptions,
	jsonBodyProperty,
	lastModifiedFilters,
	paginationProperties,
	queryOption,
	recordBodyLocator,
	recordLocator,
	requiredDate,
} from '../../shared/descriptions';
import { crudOperations, operation, operationSelector } from '../../shared/operations';
import { sendSearchList } from '../../shared/preSend';

const RESOURCE = 'contract';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const contractGetManyQueryParameters = [
	'include_deleted',
	'last_modified_at__gte',
	'last_modified_at__lte',
];

export const REVENUE_SOURCES: INodePropertyOptions[] = [
	{ name: 'HubSpot', value: 'HUBSPOT' },
	{ name: 'Manual', value: 'MANUAL' },
	{ name: 'Salesforce', value: 'SALESFORCE' },
	{ name: 'Stripe', value: 'STRIPE' },
];

const contractFields = (): INodeProperties[] =>
	[
		bodyOption({
			displayName: 'Auto Renew',
			name: 'auto_renew',
			type: 'boolean',
			default: false,
			description: 'Whether the contract renews automatically at its end date',
		}),
		bodyOption({
			displayName: 'Billing Address',
			name: 'billing_address',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Billing Frequency',
			name: 'billing_frequency',
			type: 'options',
			options: [
				{ name: 'Annual', value: 'annual' },
				{ name: 'Biannual', value: 'biannual' },
				{ name: 'Custom', value: 'custom' },
				{ name: 'Monthly', value: 'monthly' },
				{ name: 'One Time', value: 'one_time' },
				{ name: 'Quarterly', value: 'quarterly' },
			],
			default: 'annual',
		}),
		bodyDateOption('Closed Date', 'closed_date', 'Date the deal was won'),
		bodyDateOption('End Date', 'contract_end_date', 'Leave empty for an evergreen contract'),
		bodyOption({
			displayName: 'Currency',
			name: 'currency',
			type: 'string',
			default: '',
			placeholder: 'e.g. EUR',
		}),
		bodyOption({
			displayName: 'Deal ID',
			name: 'deal_id',
			type: 'string',
			default: '',
			description: 'ID of the deal in the CRM or billing system',
		}),
		bodyOption({
			displayName: 'Deal Name',
			name: 'deal_name',
			type: 'string',
			default: '',
			description:
				'Name of the contract. Campfire does not reject duplicates, so use Search by Deal Name first to keep syncs idempotent.',
		}),
		bodyIdOption('Default Payment Term ID', 'default_payment_term'),
		bodyIdOption('Department ID', 'department'),
		bodyOption({
			displayName: 'Invoice Email',
			name: 'invoice_email',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Is Evergreen',
			name: 'is_evergreen',
			type: 'boolean',
			default: false,
			description:
				'Whether the contract runs without an end date. Campfire then generates invoices ahead.',
		}),
		bodyOption({
			displayName: 'Purchase Order Number',
			name: 'purchase_order_number',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Skip Evergreen Invoice Generation',
			name: 'skip_evergreen_invoice_generation',
			type: 'boolean',
			default: false,
			description:
				'Whether to stop Campfire from generating invoices for an evergreen contract, when another system bills the customer',
		}),
		bodyOption({
			displayName: 'Source',
			name: 'source',
			type: 'options',
			options: REVENUE_SOURCES,
			default: 'MANUAL',
		}),
		bodyOption({
			displayName: 'Status',
			name: 'status',
			type: 'options',
			options: [
				{ name: 'Active', value: 'ACTIVE' },
				{ name: 'Completed', value: 'COMPLETED' },
				{ name: 'Pending', value: 'PENDING' },
			],
			default: 'ACTIVE',
		}),
		bodyOption({
			displayName: 'Total Contract Value',
			name: 'total_contract_value',
			type: 'number',
			typeOptions: { numberPrecision: 2 },
			default: 0,
			description: 'In major units of the contract currency',
		}),
		bodyOption({ displayName: 'VAT Number', name: 'vat_number', type: 'string', default: '' }),
	].sort(byDisplayName);

export const contractDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			...crudOperations({
				singular: 'contract',
				plural: 'contracts',
				path: '/rr/api/v1/contracts',
				idParameter: 'contract',
			}),
			operation({
				name: 'Search by Deal Name',
				value: 'search',
				action: 'Search contracts by deal name',
				description:
					'Find contracts by their deal names, for example to check for one before creating it',
				method: 'POST',
				url: '/rr/api/v1/contracts/bulk-search',
			}),
			operation({
				name: 'Terminate',
				value: 'terminate',
				action: 'Terminate a contract',
				description:
					'End a contract early, and optionally void its open invoices and reverse remaining revenue',
				method: 'POST',
				url: '=/rr/api/v1/contracts/{{$parameter.contract}}/terminate',
			}),
		].sort((a, b) => a.name.localeCompare(b.name)),
		'getAll',
	),
	recordLocator({
		name: 'contract',
		displayName: 'Contract',
		searchListMethod: 'getContracts',
		displayOptions: show(['delete', 'get', 'terminate', 'update']),
		description: 'The revenue contract to work with',
	}),

	// Create
	recordBodyLocator({
		name: 'customer',
		displayName: 'Customer',
		searchListMethod: 'getCustomers',
		bodyProperty: 'client',
		displayOptions: show(['create']),
		description: 'The customer the contract is with',
	}),
	recordBodyLocator({
		name: 'entity',
		displayName: 'Entity',
		searchListMethod: 'getEntities',
		bodyProperty: 'entity',
		displayOptions: show(['create']),
		description: 'The legal entity the revenue is booked in',
	}),
	requiredDate('Start Date', 'startDate', 'contract_start_date', show(['create'])),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: contractFields(),
	},
	jsonBodyProperty(
		show(['create']),
		'Other contract fields from the Campfire API reference, such as "prepaid_commits" or "tag_ids"',
		'{"tag_ids": [7737]}',
	),

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [...contractFields(), bodyDateOption('Start Date', 'contract_start_date')].sort(
			byDisplayName,
		),
	},
	jsonBodyProperty(
		show(['update']),
		'Other contract fields to change',
		'{"crm_link": "https://..."}',
	),

	// Terminate
	requiredDate('Termination Date', 'terminationDate', 'termination_date', show(['terminate'])),
	{
		displayName: 'Options',
		name: 'terminateOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['terminate']),
		options: [
			bodyOption({
				displayName: 'Credit Unused Revenue',
				name: 'credit_unused_revenue',
				type: 'boolean',
				default: false,
				description: 'Whether to issue a credit memo for revenue billed but not yet earned',
			}),
			bodyOption({
				displayName: 'Reverse Remaining Revenue',
				name: 'reverse_remaining_revenue',
				type: 'boolean',
				default: false,
				description: 'Whether to reverse revenue scheduled after the termination date',
			}),
			bodyDateOption('Void Date', 'void_date', 'Date voided invoices are reversed on'),
			{
				displayName: 'Void Invoice IDs',
				name: 'void_invoice_ids',
				type: 'string',
				default: '',
				placeholder: 'e.g. 1201, 1202',
				description: 'Comma-separated IDs of open invoices to void',
				routing: {
					send: {
						type: 'body',
						property: 'void_invoice_ids',
						value:
							'={{ $value === "" ? undefined : String($value).split(",").map((id) => Number(id.trim())).filter((id) => !isNaN(id)) }}',
					},
				},
			},
		],
	},

	// Delete
	deleteOptions(show(['delete'])),

	// Search by Deal Name
	{
		displayName: 'Deal Names',
		name: 'dealNames',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		placeholder: 'e.g. Acme Enterprise 2026',
		description: 'Deal names to look up, separated by commas or new lines',
		displayOptions: show(['search']),
		routing: { send: { preSend: [sendSearchList('dealNames', 'contracts', 'deal_name')] } },
	},

	// Get Many
	...paginationProperties(show(['getAll']), contractGetManyQueryParameters),
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
				description: 'Whether to also return deleted contracts',
			}),
			...lastModifiedFilters(),
		].sort(byDisplayName),
	},
];
