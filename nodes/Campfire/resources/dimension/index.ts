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
import { crudOperations, operation, operationSelector } from '../../shared/operations';
import { sendSearchList } from '../../shared/preSend';

const RESOURCE = 'dimension';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const dimensionGetManyQueryParameters = [
	'group',
	'include_deleted',
	'include_inactive',
	'last_modified_at__gte',
	'last_modified_at__lte',
	'parent',
	'q',
	'sort',
];

const dimensionFields = (): INodeProperties[] =>
	[
		bodyIdOption(
			'Group ID',
			'group',
			'Custom dimension group the value belongs to, such as "Marketing Channel"',
		),
		bodyOption({
			displayName: 'Active',
			name: 'is_active',
			type: 'boolean',
			default: true,
			description: 'Whether the value can be used on new transactions',
		}),
		bodyIdOption('Parent ID', 'parent'),
	].sort(byDisplayName);

export const dimensionDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			...crudOperations({
				singular: 'custom dimension',
				plural: 'custom dimensions',
				path: '/coa/api/tag',
				idParameter: 'dimension',
			}),
			operation({
				name: 'Find or Create',
				value: 'search',
				action: 'Find or create custom dimensions by name',
				description:
					'Look up custom dimension values by name, and optionally create the ones that do not exist yet',
				method: 'POST',
				url: '/coa/api/tag/bulk-search',
			}),
		].sort((a, b) => a.name.localeCompare(b.name)),
		'getAll',
	),
	recordLocator({
		name: 'dimension',
		displayName: 'Custom Dimension',
		searchListMethod: 'getDimensions',
		displayOptions: show(['delete', 'get', 'update']),
		description: 'The custom dimension value (tag) to work with',
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
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: dimensionFields(),
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
			...dimensionFields(),
			bodyOption({ displayName: 'Name', name: 'name', type: 'string', default: '' }),
		].sort(byDisplayName),
	},

	// Delete
	deleteOptions(show(['delete']), 'new_tag'),

	// Find or Create
	{
		displayName: 'Names',
		name: 'names',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		placeholder: 'e.g. Paid Search, Events',
		description: 'Custom dimension values to look up, separated by commas or new lines',
		displayOptions: show(['search']),
		routing: {
			send: {
				preSend: [sendSearchList('names', 'tags', 'name', {}, 'createMissing')],
			},
		},
	},
	{
		displayName: 'Create Missing',
		name: 'createMissing',
		type: 'boolean',
		default: false,
		description: 'Whether to create a value for every name that is not found',
		displayOptions: show(['search']),
	},

	// Get Many
	...paginationProperties(show(['getAll']), dimensionGetManyQueryParameters),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			queryOption({ displayName: 'Group ID', name: 'group', type: 'string', default: '' }),
			queryOption({
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to also return deleted values',
			}),
			queryOption({
				displayName: 'Include Inactive',
				name: 'include_inactive',
				type: 'boolean',
				default: false,
				description: 'Whether to also return inactive values',
			}),
			...lastModifiedFilters(),
			queryOption({ displayName: 'Parent ID', name: 'parent', type: 'string', default: '' }),
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
