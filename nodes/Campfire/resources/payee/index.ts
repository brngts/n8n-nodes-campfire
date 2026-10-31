import type { INodeProperties } from 'n8n-workflow';
import {
	bodyIdOption,
	bodyOption,
	byDisplayName,
	deleteOptions,
	jsonBodyProperty,
	lastModifiedFilters,
	paginationProperties,
	queryOption,
	recordLocator,
} from '../../shared/descriptions';
import { crudOperations, operation, operationSelector } from '../../shared/operations';
import { sendSearchList } from '../../shared/preSend';
import { PAYMENT_TERMS } from '../invoice';

const RESOURCE = 'payee';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const payeeGetManyQueryParameters = [
	'external_id',
	'include_deleted',
	'include_inactive',
	'last_modified_at__gte',
	'last_modified_at__lte',
	'q',
	'sort',
	'vendor_type',
];

const PAYEE_TYPES = [
	{ name: 'Customer', value: 'customer' },
	{ name: 'Employee', value: 'employee' },
	{ name: 'Vendor', value: 'vendor' },
];

const payeeFields = (): INodeProperties[] =>
	[
		bodyOption({
			displayName: 'Address Line 1',
			name: 'address_street_1',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Address Line 2',
			name: 'address_street_2',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Billing Address Line 1',
			name: 'billing_address_street_1',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Billing Address Line 2',
			name: 'billing_address_street_2',
			type: 'string',
			default: '',
		}),
		bodyOption({ displayName: 'Billing City', name: 'billing_city', type: 'string', default: '' }),
		bodyOption({
			displayName: 'Billing Country',
			name: 'billing_country',
			type: 'string',
			default: '',
			placeholder: 'e.g. DE',
		}),
		bodyOption({
			displayName: 'Billing Postal Code',
			name: 'billing_zip_code',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Billing State',
			name: 'billing_state',
			type: 'string',
			default: '',
		}),
		bodyOption({ displayName: 'City', name: 'city', type: 'string', default: '' }),
		bodyOption({ displayName: 'Company Name', name: 'company_name', type: 'string', default: '' }),
		bodyOption({
			displayName: 'Country',
			name: 'country',
			type: 'string',
			default: '',
			placeholder: 'e.g. DE',
		}),
		bodyIdOption(
			'Default Expense Account ID',
			'default_expense_category',
			'Account new bills from this vendor default to',
		),
		bodyOption({
			displayName: 'Email',
			name: 'email',
			type: 'string',
			placeholder: 'name@email.com',
			default: '',
		}),
		bodyOption({
			displayName: 'External ID',
			name: 'external_id',
			type: 'string',
			default: '',
			description: 'ID of the payee in another system, such as the CRM or billing tool',
		}),
		bodyOption({
			displayName: 'Is 1099 Vendor',
			name: 'is_1099',
			type: 'boolean',
			default: false,
			description: 'Whether the vendor receives a US 1099 form',
		}),
		bodyOption({ displayName: 'Notes', name: 'notes', type: 'string', default: '' }),
		bodyIdOption('Parent Payee ID', 'parent'),
		bodyIdOption('Payment Term ID', 'payment_term'),
		bodyOption({ displayName: 'Phone Number', name: 'phone_number', type: 'string', default: '' }),
		bodyOption({ displayName: 'Postal Code', name: 'zip_code', type: 'string', default: '' }),
		bodyOption({ displayName: 'State', name: 'state', type: 'string', default: '' }),
		bodyOption({
			displayName: 'Status',
			name: 'status',
			type: 'options',
			options: [
				{ name: 'Active', value: 'ACTIVE' },
				{ name: 'Inactive', value: 'INACTIVE' },
			],
			default: 'ACTIVE',
		}),
		bodyOption({
			displayName: 'Terms',
			name: 'terms',
			type: 'options',
			options: PAYMENT_TERMS,
			default: 'net_30',
		}),
		bodyOption({
			displayName: 'VAT Number',
			name: 'vat_number',
			type: 'string',
			default: '',
			description: 'VAT ID including the country prefix, such as DE123456789',
		}),
		bodyOption({ displayName: 'Website', name: 'website', type: 'string', default: '' }),
	].sort(byDisplayName);

export const payeeDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			...crudOperations({
				singular: 'payee',
				plural: 'payees',
				path: '/coa/api/vendor',
				idParameter: 'payee',
			}),
			operation({
				name: 'Find or Create',
				value: 'search',
				action: 'Find or create payees by name',
				description: 'Look up payees by name, and optionally create the ones that do not exist yet',
				method: 'POST',
				url: '/coa/api/vendor/bulk-search',
			}),
		].sort((a, b) => a.name.localeCompare(b.name)),
		'getAll',
	),
	recordLocator({
		name: 'payee',
		displayName: 'Payee',
		searchListMethod: 'getPayees',
		displayOptions: show(['delete', 'get', 'update']),
		description: 'The vendor, customer or employee to work with',
	}),

	// Create
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show(['create']),
		routing: { send: { type: 'body', property: 'name' } },
	},
	{
		displayName: 'Payee Type',
		name: 'payeeType',
		type: 'options',
		options: PAYEE_TYPES,
		default: 'vendor',
		description: 'Campfire keeps vendors, customers and employees in one list of payees',
		displayOptions: show(['create']),
		routing: { send: { type: 'body', property: 'vendor_type' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: payeeFields(),
	},
	jsonBodyProperty(
		show(['create']),
		'Other payee fields from the Campfire API reference, such as "contacts"',
		'{"contacts": [{"name": "Accounts Payable", "email": "ap@example.com"}]}',
	),

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [
			...payeeFields(),
			bodyOption({ displayName: 'Name', name: 'name', type: 'string', default: '' }),
		].sort(byDisplayName),
	},
	jsonBodyProperty(
		show(['update']),
		'Other payee fields to change',
		'{"invoice_message": "Thank you"}',
	),

	// Delete
	deleteOptions(show(['delete']), 'new_vendor'),

	// Find or Create
	{
		displayName: 'Names',
		name: 'names',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		placeholder: 'e.g. Acme GmbH, Globex Ltd',
		description: 'Payee names to look up, separated by commas or new lines',
		displayOptions: show(['search']),
		routing: {
			send: {
				preSend: [
					sendSearchList(
						'names',
						'vendors',
						'name',
						{ vendor_type: 'searchPayeeType' },
						'createMissing',
					),
				],
			},
		},
	},
	{
		displayName: 'Payee Type',
		name: 'searchPayeeType',
		type: 'options',
		options: PAYEE_TYPES,
		default: 'vendor',
		displayOptions: show(['search']),
	},
	{
		displayName: 'Create Missing',
		name: 'createMissing',
		type: 'boolean',
		default: false,
		description: 'Whether to create a payee for every name that is not found',
		displayOptions: show(['search']),
	},

	// Get Many
	...paginationProperties(show(['getAll']), payeeGetManyQueryParameters),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			queryOption({ displayName: 'External ID', name: 'external_id', type: 'string', default: '' }),
			queryOption({
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to also return deleted payees',
			}),
			queryOption({
				displayName: 'Include Inactive',
				name: 'include_inactive',
				type: 'boolean',
				default: false,
				description: 'Whether to also return inactive payees',
			}),
			...lastModifiedFilters(),
			queryOption({
				displayName: 'Payee Type',
				name: 'vendor_type',
				type: 'options',
				options: PAYEE_TYPES,
				default: 'vendor',
			}),
			queryOption({ displayName: 'Search', name: 'q', type: 'string', default: '' }),
			queryOption({
				displayName: 'Sort',
				name: 'sort',
				type: 'string',
				default: '',
				placeholder: 'e.g. name',
				description: 'Field to sort by. Prefix with "-" for descending.',
			}),
		].sort(byDisplayName),
	},
];
