import type { INodeProperties } from 'n8n-workflow';
import { byDisplayName, queryOption, recordLocator } from '../../shared/descriptions';
import { operation, operationSelector } from '../../shared/operations';

const RESOURCE = 'entity';

const show = (operations: string[]) => ({ show: { resource: [RESOURCE], operation: operations } });

export const entityDescription: INodeProperties[] = [
	operationSelector(
		RESOURCE,
		[
			operation({
				name: 'Get',
				value: 'get',
				action: 'Get an entity',
				description: 'Get a legal entity by ID',
				method: 'GET',
				url: '=/coa/api/entity/{{$parameter.entityId}}',
			}),
			operation({
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many entities',
				description: 'List every legal entity in the workspace',
				method: 'GET',
				url: '/coa/api/entity',
			}),
		],
		'getAll',
	),
	recordLocator({
		name: 'entityId',
		displayName: 'Entity',
		searchListMethod: 'getEntities',
		displayOptions: show(['get']),
		description: 'The legal entity to get',
	}),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show(['getAll']),
		options: [
			queryOption({
				displayName: 'Exclude Adjusting Entities',
				name: 'exclude_adjusting',
				type: 'boolean',
				default: false,
				description: 'Whether to leave out entities that only hold consolidation adjustments',
			}),
			queryOption({
				displayName: 'Include Inactive',
				name: 'include_inactive',
				type: 'boolean',
				default: false,
				description: 'Whether to also return inactive entities',
			}),
		].sort(byDisplayName),
	},
];
