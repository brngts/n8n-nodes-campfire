import type { INodeProperties } from 'n8n-workflow';
import {
	bodyDateOption,
	bodyIdOption,
	bodyOption,
	byDisplayName,
	deleteOptions,
	idField,
	jsonBodyProperty,
	paginationProperties,
	queryDateOption,
	queryOption,
	recordBodyLocator,
	requiredDate,
} from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';
import { sendJournalLines } from '../../shared/preSend';

const RESOURCE = 'journalEntry';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const journalEntryGetManyQueryParameters = [
	'account',
	'all_time',
	'end_date',
	'source',
	'start_date',
];

const journalLines = (operations: string[], required: boolean): INodeProperties => ({
	displayName: 'Lines',
	name: 'lines',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	placeholder: 'Add Line',
	default: {},
	required,
	description: required
		? 'Debit and credit lines. Debits must equal credits. Lines can also be sent as "transactions" in the JSON field, for book or consolidation amounts and intercompany entries.'
		: 'Replaces every line of the journal entry. Leave empty to keep the current lines.',
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
				},
				{
					displayName: 'Amount',
					name: 'amount',
					type: 'number',
					typeOptions: { numberPrecision: 2 },
					default: 0,
					description:
						'Amount in the journal currency, in major units. Campfire converts book and consolidation amounts.',
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
					displayName: 'Entity ID',
					name: 'entity',
					type: 'string',
					default: '',
					description: 'Only for intercompany entries, where each line names its own entity',
				},
				{
					displayName: 'Payee ID',
					name: 'payee',
					type: 'string',
					default: '',
					description: 'Vendor, customer or employee the line relates to',
				},
				{
					displayName: 'Side',
					name: 'side',
					type: 'options',
					options: [
						{ name: 'Credit', value: 'credit' },
						{ name: 'Debit', value: 'debit' },
					],
					default: 'debit',
				},
			],
		},
	],
	routing: {
		send: {
			preSend: [sendJournalLines],
		},
	},
});

const journalFields = (): INodeProperties[] =>
	[
		bodyOption({
			displayName: 'Currency',
			name: 'currency',
			type: 'string',
			default: '',
			placeholder: 'e.g. EUR',
			description: 'ISO currency code of the entry. Defaults to the entity currency.',
		}),
		bodyOption({
			displayName: 'Exchange Rate',
			name: 'exchange_rate_book',
			type: 'number',
			typeOptions: { numberPrecision: 6 },
			default: 1,
			description:
				'Rate from the entry currency to the entity currency. Campfire computes it when left out.',
		}),
		bodyOption({
			displayName: 'Journal Number',
			name: 'order',
			type: 'string',
			default: '',
			description: 'Journal number. Campfire assigns the next one when left out.',
		}),
		bodyOption({
			displayName: 'Reference Number',
			name: 'ref_number',
			type: 'string',
			default: '',
		}),
		bodyDateOption(
			'Reversal Date',
			'reversal_date',
			'Also posts a reversing entry on this date, for accruals',
		),
		bodyOption({
			displayName: 'Source',
			name: 'source',
			type: 'string',
			default: '',
			placeholder: 'e.g. n8n',
			description: 'Name of the system the entry came from',
		}),
		bodyOption({
			displayName: 'Source ID',
			name: 'source_id',
			type: 'string',
			default: '',
			description: 'ID of the entry in the source system, for tracing it back',
		}),
	].sort(byDisplayName);

export const journalEntryDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Create',
				value: 'create',
				action: 'Create a journal entry',
				description: 'Post a manual journal entry',
				method: 'POST',
				url: '/coa/api/journal_entry',
			}),
			operation({
				name: 'Delete',
				value: 'delete',
				action: 'Delete a journal entry',
				description: 'Delete a journal entry',
				method: 'POST',
				url: '=/coa/api/journal_entry/{{$parameter.journalEntryId}}/delete',
				output: 'success',
			}),
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get a journal entry',
				description: 'Get a journal entry and its lines by ID',
				method: 'GET',
				url: '=/coa/api/journal_entry/{{$parameter.journalEntryId}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many journal entries',
				description: 'List journal entries with their lines',
				method: 'GET',
				url: '/coa/api/journal_entry',
				output: 'list',
			}),
			operation({
				name: 'Update',
				value: 'update',
				action: 'Update a journal entry',
				description: 'Change fields of a journal entry',
				method: 'PATCH',
				url: '=/coa/api/journal_entry/{{$parameter.journalEntryId}}',
			}),
		],
		'getAll',
	),
	idField(
		'journalEntryId',
		'Journal Entry ID',
		show(['delete', 'get', 'update']),
		'The numeric ID of the journal entry (the "id" field, not the journal number)',
	),

	// Create
	recordBodyLocator({
		name: 'entity',
		displayName: 'Entity',
		searchListMethod: 'getEntities',
		bodyProperty: 'entity',
		displayOptions: show(['create']),
		description: 'The legal entity the entry is booked in',
	}),
	requiredDate('Date', 'date', 'date', show(['create']), 'Posting date of the entry'),
	{
		displayName: 'Memo',
		name: 'memo',
		type: 'string',
		default: '',
		required: true,
		description: 'Header description of the journal entry',
		displayOptions: show(['create']),
		routing: { send: { type: 'body', property: 'memo' } },
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'hidden',
		default: 'journal_entry',
		displayOptions: show(['create']),
		routing: { send: { type: 'body', property: 'type' } },
	},
	journalLines(['create'], true),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: journalFields(),
	},
	jsonBodyProperty(
		show(['create']),
		'Other journal entry fields from the Campfire API reference. Set "transactions" here instead of the Lines form for book or consolidation amounts, or "entities" for intercompany entries.',
		'{"use_average_rate": true}',
	),

	// Update
	journalLines(['update'], false),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['update']),
		options: [
			...journalFields(),
			bodyDateOption('Date', 'date'),
			bodyIdOption('Entity ID', 'entity'),
			bodyOption({ displayName: 'Memo', name: 'memo', type: 'string', default: '' }),
		].sort(byDisplayName),
	},
	jsonBodyProperty(
		show(['update']),
		'Other journal entry fields to change',
		'{"memo": "Corrected accrual"}',
	),

	// Delete
	deleteOptions(show(['delete'])),

	// Get Many
	...paginationProperties(show(['getAll']), journalEntryGetManyQueryParameters),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			queryOption({
				displayName: 'Account ID',
				name: 'account',
				type: 'string',
				default: '',
				description: 'Only entries with a line on this account',
			}),
			queryOption({
				displayName: 'All Time',
				name: 'all_time',
				type: 'boolean',
				default: false,
				description: 'Whether to ignore the date range and return entries from every period',
			}),
			queryDateOption('From Date', 'start_date', 'Only entries dated on or after this day'),
			queryOption({
				displayName: 'Source',
				name: 'source',
				type: 'string',
				default: '',
				description:
					'Only entries from this source, such as "bill", "invoice" or a name you set on create',
			}),
			queryDateOption('To Date', 'end_date', 'Only entries dated on or before this day'),
		].sort(byDisplayName),
	},
];
