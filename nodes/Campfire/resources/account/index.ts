import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import {
	bodyIdOption,
	bodyOption,
	byDisplayName,
	deleteOptions,
	paginationProperties,
	recordLocator,
} from '../../shared/descriptions';
import { crudOperations, operationSelector } from '../../shared/operations';

const RESOURCE = 'account';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

/** The account list endpoint takes no filters. */
export const accountGetManyQueryParameters: string[] = [];

const ACCOUNT_TYPES: INodePropertyOptions[] = [
	{ name: 'Asset', value: 'ASSET' },
	{ name: 'Cost Allocation', value: 'COST_ALLOCATION' },
	{ name: 'Cost of Goods Sold', value: 'COGS' },
	{ name: 'Equity', value: 'EQUITY' },
	{ name: 'Liability', value: 'LIABILITY' },
	{ name: 'Operating Expenses', value: 'OPERATING_EXPENSES' },
	{ name: 'Other Expense', value: 'OTHER_EXPENSE' },
	{ name: 'Other Income', value: 'OTHER_INCOME' },
	{ name: 'Revenue', value: 'REVENUE' },
	{ name: 'Uncategorized', value: 'UNCATEGORIZED' },
];

const ACCOUNT_SUBTYPES: INodePropertyOptions[] = [
	'ACCOUNTS_PAYABLE',
	'ACCOUNTS_RECEIVABLE',
	'ACCRUED_REVENUE',
	'BANK',
	'COST_ALLOCATION',
	'COST_OF_GOODS_SOLD',
	'CREDIT_CARD',
	'DEFERRED_EXPENSE',
	'DEFERRED_REVENUE',
	'EQUITY',
	'EXPENSE',
	'FIXED_ASSET',
	'INCOME',
	'LONG_TERM_LIABILITY',
	'OTHER_ASSET',
	'OTHER_CURRENT_ASSET',
	'OTHER_CURRENT_LIABILITY',
	'OTHER_EXPENSE',
	'OTHER_INCOME',
	'PREPAID',
	'REALIZED_GAIN_LOSS',
	'RETAINED_EARNINGS',
	'SALES_TAX_PAYABLE',
	'SALES_TAX_RECEIVABLE',
	'UNAPPLIED_CREDITS',
	'UNBILLED_RECEIVABLE',
	'UNCATEGORIZED',
	'UNREALIZED_GAIN_LOSS',
].map((value) => ({
	name: value
		.toLowerCase()
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' '),
	value,
}));

const accountFields = (): INodeProperties[] =>
	[
		bodyOption({
			displayName: 'Cash Flow Classification',
			name: 'account_cashflow_classification',
			type: 'options',
			options: [
				{ name: 'Financing', value: 'FINANCING' },
				{ name: 'Investing', value: 'INVESTING' },
				{ name: 'None', value: 'NONE' },
				{ name: 'Operating', value: 'OPERATING' },
			],
			default: 'OPERATING',
		}),
		bodyOption({
			displayName: 'Currency',
			name: 'currency',
			type: 'string',
			default: '',
			placeholder: 'e.g. EUR',
		}),
		bodyIdOption('Default Department ID', 'default_department'),
		bodyOption({ displayName: 'Description', name: 'description', type: 'string', default: '' }),
		bodyOption({ displayName: 'Nickname', name: 'nickname', type: 'string', default: '' }),
		bodyIdOption('Parent Account ID', 'parent', 'Makes this a sub-account of another account'),
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
			displayName: 'Subtype',
			name: 'account_subtype',
			type: 'options',
			options: ACCOUNT_SUBTYPES,
			default: 'EXPENSE',
		}),
	].sort(byDisplayName);

export const accountDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		crudOperations({
			singular: 'account',
			plural: 'accounts',
			path: '/coa/api/account',
			idParameter: 'account',
		}),
		'getAll',
	),
	recordLocator({
		name: 'account',
		displayName: 'Account',
		searchListMethod: 'getAccounts',
		displayOptions: show(['delete', 'get', 'update']),
		description: 'The chart of accounts entry to work with',
	}),

	// Create
	{
		displayName: 'Number',
		name: 'number',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 6300',
		description: 'Account number in the chart of accounts',
		displayOptions: show(['create']),
		routing: { send: { type: 'body', property: 'number' } },
	},
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
		displayName: 'Type',
		name: 'accountType',
		type: 'options',
		options: ACCOUNT_TYPES,
		default: 'OPERATING_EXPENSES',
		displayOptions: show(['create']),
		routing: { send: { type: 'body', property: 'account_type' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: accountFields(),
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [
			...accountFields(),
			bodyOption({ displayName: 'Name', name: 'name', type: 'string', default: '' }),
			bodyOption({ displayName: 'Number', name: 'number', type: 'string', default: '' }),
			bodyOption({
				displayName: 'Type',
				name: 'account_type',
				type: 'options',
				options: ACCOUNT_TYPES,
				default: 'OPERATING_EXPENSES',
			}),
		].sort(byDisplayName),
	},

	// Delete
	deleteOptions(show(['delete']), 'new_account'),

	// Get Many
	...paginationProperties(show(['getAll']), accountGetManyQueryParameters),
];
