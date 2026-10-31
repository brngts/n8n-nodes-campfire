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

const RESOURCE = 'department';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const departmentGetManyQueryParameters = [
	'include_deleted',
	'include_inactive',
	'last_modified_at__gte',
	'last_modified_at__lte',
	'q',
	'sort',
];

const departmentFields = (): INodeProperties[] =>
	[
		bodyOption({
			displayName: 'Active',
			name: 'active',
			type: 'boolean',
			default: true,
			description: 'Whether the department can be used on new transactions',
		}),
		bodyOption({ displayName: 'Display Name', name: 'display_name', type: 'string', default: '' }),
		bodyIdOption('Parent Department ID', 'parent'),
	].sort(byDisplayName);

export const departmentDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			...crudOperations({
				singular: 'department',
				plural: 'departments',
				path: '/coa/api/department',
				idParameter: 'department',
			}),
			operation({
				name: 'Find or Create',
				value: 'search',
				action: 'Find or create departments by name',
				description:
					'Look up departments by name, and optionally create the ones that do not exist yet',
				method: 'POST',
				url: '/coa/api/department/bulk-search',
			}),
		].sort((a, b) => a.name.localeCompare(b.name)),
		'getAll',
	),
	recordLocator({
		name: 'department',
		displayName: 'Department',
		searchListMethod: 'getDepartments',
		displayOptions: show(['delete', 'get', 'update']),
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
		displayName: 'Code',
		name: 'code',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 4100',
		description: 'Short code of the department, shown next to its name',
		displayOptions: show(['create']),
		routing: { send: { type: 'body', property: 'code' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['create']),
		options: departmentFields(),
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
			...departmentFields(),
			bodyOption({ displayName: 'Code', name: 'code', type: 'string', default: '' }),
			bodyOption({ displayName: 'Name', name: 'name', type: 'string', default: '' }),
		].sort(byDisplayName),
	},

	// Delete
	deleteOptions(show(['delete']), 'new_department'),

	// Find or Create
	{
		displayName: 'Names',
		name: 'names',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		placeholder: 'e.g. Finance, Marketing',
		description: 'Department names to look up, separated by commas or new lines',
		displayOptions: show(['search']),
		routing: {
			send: {
				preSend: [sendSearchList('names', 'departments', 'name', {}, 'createMissing')],
			},
		},
	},
	{
		displayName: 'Create Missing',
		name: 'createMissing',
		type: 'boolean',
		default: false,
		description: 'Whether to create a department for every name that is not found',
		displayOptions: show(['search']),
	},

	// Get Many
	...paginationProperties(show(['getAll']), departmentGetManyQueryParameters),
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
				description: 'Whether to also return deleted departments',
			}),
			queryOption({
				displayName: 'Include Inactive',
				name: 'include_inactive',
				type: 'boolean',
				default: false,
				description: 'Whether to also return inactive departments',
			}),
			...lastModifiedFilters(),
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
