import type { INodeProperties } from 'n8n-workflow';
import {
	bodyDateOption,
	bodyIdOption,
	bodyOption,
	byDisplayName,
	deleteOptions,
	idField,
	jsonBodyProperty,
	lastModifiedFilters,
	queryOption,
	recordBodyLocator,
	recordLocator,
	requiredDate,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { REVENUE_SOURCES } from '../contract';

const RESOURCE = 'subscription';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

const BASE = '=/rr/api/v1/contracts/{{$parameter.contract}}/subscriptions';

const subscriptionFields = (): INodeProperties[] =>
	[
		bodyOption({
			displayName: 'Billing Cadence',
			name: 'billing_cadence',
			type: 'options',
			options: [
				{ name: 'Annual', value: 'annual' },
				{ name: 'Biannual', value: 'biannual' },
				{ name: 'Monthly', value: 'monthly' },
				{ name: 'One Time', value: 'one_time' },
				{ name: 'Quarterly', value: 'quarterly' },
			],
			default: 'annual',
		}),
		bodyOption({
			displayName: 'Billing Timing',
			name: 'billing_timing',
			type: 'options',
			options: [
				{ name: 'In Advance', value: 'advance' },
				{ name: 'In Arrears', value: 'arrears' },
			],
			default: 'advance',
		}),
		bodyOption({
			displayName: 'Discount',
			name: 'discount',
			type: 'number',
			typeOptions: { numberPrecision: 2 },
			default: 0,
		}),
		bodyOption({
			displayName: 'External ID',
			name: 'external_id',
			type: 'string',
			default: '',
			description:
				'ID of the subscription in the billing system. Not enforced as unique by Campfire.',
		}),
		bodyDateOption('First Invoice Date', 'first_invoice_date'),
		bodyOption({
			displayName: 'MRR',
			name: 'mrr',
			type: 'number',
			typeOptions: { numberPrecision: 2 },
			default: 0,
			description:
				'Monthly recurring revenue, in major units. Campfire builds the revenue schedule from it.',
		}),
		bodyOption({ displayName: 'Notes', name: 'notes', type: 'string', default: '' }),
		bodyOption({
			displayName: 'Period Amount',
			name: 'period_amount',
			type: 'number',
			typeOptions: { numberPrecision: 2 },
			default: 0,
			description: 'Amount billed per billing period, in major units',
		}),
		bodyOption({
			displayName: 'Proration Method',
			name: 'proration_method',
			type: 'options',
			options: [
				{ name: 'Daily', value: 'daily' },
				{ name: 'Standard', value: 'standard' },
				{ name: 'Thirty Day', value: 'thirty_day' },
			],
			default: 'standard',
		}),
		bodyOption({ displayName: 'Quantity', name: 'quantity', type: 'number', default: 1 }),
		bodyOption({
			displayName: 'Rate',
			name: 'rate',
			type: 'number',
			typeOptions: { numberPrecision: 2 },
			default: 0,
			description: 'Price per unit and month, in major units',
		}),
		bodyOption({
			displayName: 'Renewal Behavior',
			name: 'renewal_behavior',
			type: 'options',
			options: [
				{ name: 'Fixed End', value: 'FIXED_END' },
				{ name: 'Follow Contract', value: 'FOLLOW_CONTRACT' },
			],
			default: 'FOLLOW_CONTRACT',
		}),
		bodyOption({
			displayName: 'Source',
			name: 'source',
			type: 'options',
			options: REVENUE_SOURCES,
			default: 'MANUAL',
		}),
		bodyOption({
			displayName: 'Use Daily Accounting',
			name: 'use_daily_accounting',
			type: 'boolean',
			default: false,
			description: 'Whether revenue is recognized per day instead of per month',
		}),
	].sort(byDisplayName);

export const subscriptionDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Create',
				value: 'create',
				action: 'Create a subscription',
				description: 'Add a subscription line to a revenue contract',
				method: 'POST',
				url: BASE,
			}),
			operation({
				name: 'Delete',
				value: 'delete',
				action: 'Delete a subscription',
				description: 'Remove a subscription from a contract',
				method: 'POST',
				url: `${BASE}/{{$parameter.subscriptionId}}/delete`,
				output: 'success',
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a subscription',
				description: 'Get a subscription with its revenue schedule lines',
				method: 'GET',
				url: `${BASE}/{{$parameter.subscriptionId}}`,
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many subscriptions',
				description: 'List the subscriptions of a contract',
				method: 'GET',
				url: BASE,
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update a subscription',
				description: 'Change fields of a subscription',
				method: 'PATCH',
				url: `${BASE}/{{$parameter.subscriptionId}}`,
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'contract',
		displayName: 'Contract',
		searchListMethod: 'getContracts',
		displayOptions: { show: { resource: [RESOURCE] } },
		description: 'The revenue contract the subscription belongs to',
	}),
	idField(
		'subscriptionId',
		'Subscription ID',
		show(['delete', 'get', 'update']),
		'The numeric ID of the subscription within the contract',
	),

	// Create
	{
		displayName: 'Contract (Body)',
		name: 'contractBody',
		type: 'hidden',
		default: '',
		displayOptions: show(['create']),
		routing: {
			send: {
				type: 'body',
				property: 'contract',
				value: '={{ Number($parameter.contract) }}',
			},
		},
	},
	recordBodyLocator({
		name: 'product',
		displayName: 'Product',
		searchListMethod: 'getProducts',
		bodyProperty: 'product',
		displayOptions: show(['create']),
		description: 'The product the subscription is for. It sets the revenue accounts.',
	}),
	requiredDate('Start Date', 'startDate', 'start_date', show(['create'])),
	requiredDate('End Date', 'endDate', 'end_date', show(['create'])),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: subscriptionFields(),
	},
	jsonBodyProperty(
		show(['create']),
		'Other subscription fields from the Campfire API reference. For ramp deals, send "lines" with one entry per period.',
		'{"lines": [{"start_date": "2026-01-01", "end_date": "2026-12-31", "total_value": 12000}]}',
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
			...subscriptionFields(),
			bodyDateOption('End Date', 'end_date'),
			bodyIdOption('Product ID', 'product'),
			bodyDateOption('Start Date', 'start_date'),
		].sort(byDisplayName),
	},
	jsonBodyProperty(show(['update']), 'Other subscription fields to change', '{"notes": "Upsell"}'),

	// Delete
	deleteOptions(show(['delete'])),

	// Get Many
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
				description: 'Whether to also return deleted subscriptions',
			}),
			...lastModifiedFilters(),
		].sort(byDisplayName),
	},
];
