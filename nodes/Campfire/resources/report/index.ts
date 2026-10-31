import type { INodeProperties } from 'n8n-workflow';
import { byDisplayName, queryOption } from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';

const RESOURCE = 'report';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

const cadence = () =>
	queryOption({
		displayName: 'Cadence',
		name: 'cadence',
		type: 'options',
		options: [
			{ name: 'Daily', value: 'daily' },
			{ name: 'Monthly', value: 'monthly' },
			{ name: 'Quarterly', value: 'quarterly' },
			{ name: 'Weekly', value: 'weekly' },
			{ name: 'Yearly', value: 'yearly' },
		],
		default: 'monthly',
		description: 'Length of each period (column) in the report',
	});

const commonOptions = (): INodeProperties[] => [
	queryOption({
		displayName: 'Entity ID',
		name: 'entity',
		type: 'string',
		default: '',
		description: 'Limit the report to one legal entity. Defaults to all entities.',
	}),
	queryOption({
		displayName: 'Include Child Entities',
		name: 'entity_rollup',
		type: 'boolean',
		default: false,
		description: "Whether to consolidate the data of the entity's child entities",
	}),
	queryOption({
		displayName: 'Group By',
		name: 'group_by',
		type: 'string',
		default: '',
		placeholder: 'e.g. department',
		description: 'Break the report down by a dimension, such as department or entity',
	}),
];

export const reportDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Get Balance Sheet',
				value: 'balanceSheet',
				action: 'Get the balance sheet',
				description: 'Ending account balances for each period in the date range',
				method: 'GET',
				url: '/ca/api/get_balance_sheet',
			}),
			operation({
				name: 'Get Income Statement',
				value: 'incomeStatement',
				action: 'Get the income statement',
				description: 'Revenue and expenses for each period in the date range',
				method: 'GET',
				url: '/ca/api/get_income_statement',
			}),
			operation({
				name: 'Get Trial Balance',
				value: 'trialBalance',
				action: 'Get the trial balance',
				description: 'Debit and credit totals for each account',
				method: 'GET',
				url: '/ca/api/get_trial_balance',
			}),
		],
		'trialBalance',
	),
	{
		displayName: 'From Date',
		name: 'startDate',
		type: 'dateTime',
		default: '',
		description:
			'First day of the report. Balance sheet balances still accumulate from the beginning of time; this only sets the first period shown.',
		displayOptions: show(['balanceSheet', 'incomeStatement', 'trialBalance']),
		routing: {
			send: {
				type: 'query',
				property: 'start_date',
				value: '={{ $value ? String($value).slice(0, 10) : undefined }}',
			},
		},
	},
	{
		displayName: 'To Date',
		name: 'endDate',
		type: 'dateTime',
		default: '',
		description: 'Last day of the report. Defaults to the end of the current month.',
		displayOptions: show(['balanceSheet', 'incomeStatement', 'trialBalance']),
		routing: {
			send: {
				type: 'query',
				property: 'end_date',
				value: '={{ $value ? String($value).slice(0, 10) : undefined }}',
			},
		},
	},
	{
		displayName: 'Options',
		name: 'statementOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['balanceSheet', 'incomeStatement']),
		options: [cadence(), ...commonOptions()].sort(byDisplayName),
	},
	{
		displayName: 'Options',
		name: 'trialBalanceOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show(['trialBalance']),
		options: [
			...commonOptions(),
			queryOption({
				displayName: 'Currency Basis',
				name: 'basis',
				type: 'options',
				options: [
					{
						name: 'Transaction Rates',
						value: 'transaction_rates',
						description: 'Balances as converted when each transaction was posted',
					},
					{
						name: 'Translated',
						value: 'translated',
						description: 'Balances translated at closing and average rates when the report runs',
					},
				],
				default: 'transaction_rates',
			}),
			queryOption({
				displayName: 'Department ID',
				name: 'department',
				type: 'string',
				default: '',
			}),
			queryOption({
				displayName: 'Income Statement Window',
				name: 'income_statement_basis',
				type: 'options',
				options: [
					{ name: 'Fiscal Year to Date', value: 'fiscal_ytd' },
					{ name: 'Selected Period', value: 'period' },
				],
				default: 'period',
				description: 'Which window income statement accounts are summed over',
			}),
		].sort(byDisplayName),
	},
];
