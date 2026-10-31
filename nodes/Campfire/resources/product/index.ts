import type { INodeProperties } from 'n8n-workflow';
import {
	bodyIdOption,
	bodyOption,
	byDisplayName,
	deleteOptions,
	lastModifiedFilters,
	paginationProperties,
	queryOption,
	recordLocator,
} from '../../shared/descriptions';
import { crudOperations, operationSelector } from '../../shared/operations';

const RESOURCE = 'product';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const productGetManyQueryParameters = [
	'include_deleted',
	'last_modified_at__gte',
	'last_modified_at__lte',
];

const productFields = (): INodeProperties[] =>
	[
		bodyIdOption('AR Account ID', 'ar_account'),
		bodyOption({
			displayName: 'Cost',
			name: 'cost',
			type: 'number',
			typeOptions: { numberPrecision: 2 },
			default: 0,
		}),
		bodyOption({
			displayName: 'Currency',
			name: 'currency',
			type: 'string',
			default: '',
			placeholder: 'e.g. EUR',
		}),
		bodyIdOption('Department ID', 'department'),
		bodyOption({
			displayName: 'Description',
			name: 'product_description',
			type: 'string',
			default: '',
		}),
		bodyOption({
			displayName: 'Exclude From MRR',
			name: 'exclude_from_mrr',
			type: 'boolean',
			default: false,
			description: 'Whether revenue from this product is left out of MRR metrics',
		}),
		bodyIdOption('Invoice Account ID', 'invoice_account'),
		bodyOption({
			displayName: 'Is Renewable',
			name: 'is_renewable',
			type: 'boolean',
			default: true,
			description: 'Whether subscriptions to this product renew with the contract',
		}),
		bodyOption({
			displayName: 'Is Taxable',
			name: 'is_taxable',
			type: 'boolean',
			default: true,
			description: 'Whether the product is taxable',
		}),
		bodyOption({
			displayName: 'Price',
			name: 'price',
			type: 'number',
			typeOptions: { numberPrecision: 2 },
			default: 0,
		}),
		bodyOption({
			displayName: 'Product Code',
			name: 'product_id',
			type: 'string',
			default: '',
			placeholder: 'e.g. ENT-ANNUAL',
			description: 'Your own SKU or code for the product',
		}),
		bodyIdOption('Revenue Account ID', 'revenue_account'),
		bodyOption({
			displayName: 'Recognize Revenue',
			name: 'recognize_revenue',
			type: 'boolean',
			default: true,
			description: 'Whether Campfire builds a revenue recognition schedule for this product',
		}),
	].sort(byDisplayName);

export const productDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		crudOperations({
			singular: 'product',
			plural: 'products',
			path: '/rr/api/v1/product',
			idParameter: 'product',
		}),
		'getAll',
	),
	recordLocator({
		name: 'product',
		displayName: 'Product',
		searchListMethod: 'getProducts',
		displayOptions: show(['delete', 'get', 'update']),
	}),

	// Create
	{
		displayName: 'Name',
		name: 'productName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: show(['create']),
		routing: { send: { type: 'body', property: 'product_name' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: productFields(),
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
			...productFields(),
			bodyOption({ displayName: 'Name', name: 'product_name', type: 'string', default: '' }),
		].sort(byDisplayName),
	},

	// Delete
	deleteOptions(show(['delete']), 'new_product'),

	// Get Many
	...paginationProperties(show(['getAll']), productGetManyQueryParameters),
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
				description: 'Whether to also return deleted products',
			}),
			...lastModifiedFilters(),
		].sort(byDisplayName),
	},
];
