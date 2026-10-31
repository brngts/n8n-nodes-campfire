import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';
import { PAGE_SIZE } from './constants';
import { offsetPagination } from './pagination';
import { mergeJsonBody } from './preSend';

type LocatorOptions = {
	name: string;
	displayName: string;
	searchListMethod: string;
	displayOptions: IDisplayOptions;
	description?: string;
	required?: boolean;
};

/** "From List" or "By ID" picker for a Campfire record. Campfire IDs are integers. */
export function recordLocator({
	name,
	displayName,
	searchListMethod,
	displayOptions,
	description,
	required = true,
}: LocatorOptions): INodeProperties {
	return {
		displayName,
		name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required,
		description: description ?? `The ${displayName.toLowerCase()} to work with`,
		displayOptions,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: `Select ${/^[aeiou]/i.test(displayName) ? 'an' : 'a'} ${displayName.toLowerCase()}...`,
				typeOptions: {
					searchListMethod,
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 12345',
				validation: [
					{
						type: 'regex',
						properties: { regex: '^\\d+$', errorMessage: 'Campfire IDs are numbers' },
					},
				],
			},
		],
	};
}

/** A record picker whose selected ID is sent as an integer body field, such as a bill's `vendor`. */
export function recordBodyLocator(
	options: LocatorOptions & { bodyProperty: string },
): INodeProperties {
	const { bodyProperty, ...locator } = options;
	return {
		...recordLocator(locator),
		routing: {
			send: {
				type: 'body',
				property: bodyProperty,
				value: `={{ Number($parameter.${locator.name}) }}`,
			},
		},
	};
}

/** A plain numeric ID field, for records that have no list to pick from. */
export function idField(
	name: string,
	displayName: string,
	displayOptions: IDisplayOptions,
	description: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 12345',
		description,
		displayOptions,
	};
}

/**
 * "Return All" and "Limit" for a list endpoint. `queryParameters` lists every
 * filter the operation may send, so the pagination loop can repeat them on
 * follow-up requests.
 */
export function paginationProperties(
	displayOptions: IDisplayOptions,
	queryParameters: string[],
): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions,
			routing: {
				send: {
					paginate: '={{ $value }}',
					type: 'query',
					property: 'limit',
					value: `={{ $value ? ${PAGE_SIZE} : undefined }}`,
				},
				operations: {
					pagination: offsetPagination(queryParameters),
				},
			},
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			default: 50,
			description: 'Max number of results to return',
			typeOptions: {
				minValue: 1,
				maxValue: PAGE_SIZE,
			},
			displayOptions: {
				...displayOptions,
				show: {
					...displayOptions.show,
					returnAll: [false],
				},
			},
			routing: {
				send: {
					type: 'query',
					property: 'limit',
				},
				output: {
					maxResults: '={{ $value }}',
				},
			},
		},
	];
}

/** Free-form JSON merged into the request body, for nested structures the form does not cover. */
export function jsonBodyProperty(
	displayOptions: IDisplayOptions,
	description: string,
	placeholder: string,
): INodeProperties {
	return {
		displayName: 'Additional Body Fields (JSON)',
		name: 'jsonBody',
		type: 'json',
		default: '{}',
		placeholder,
		description,
		displayOptions,
		routing: {
			send: {
				preSend: [mergeJsonBody('jsonBody', 'Additional Body Fields (JSON)')],
			},
		},
	};
}

export function binaryPropertyName(displayOptions: IDisplayOptions, hint: string): INodeProperties {
	return {
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint,
		displayOptions,
	};
}

/** A "Filters" or "Fields" collection entry that sends one query parameter. */
export function queryOption(
	option: Omit<INodeProperties, 'routing'>,
	property = option.name,
): INodeProperties {
	return {
		...option,
		routing: {
			send: {
				type: 'query',
				property,
				value: '={{ $value === "" ? undefined : $value }}',
			},
		},
	};
}

/** A collection entry that sends one body field. */
export function bodyOption(
	option: Omit<INodeProperties, 'routing'>,
	property = option.name,
): INodeProperties {
	return {
		...option,
		routing: {
			send: {
				type: 'body',
				property,
			},
		},
	};
}

/** A collection entry holding a record ID, sent as an integer body field. */
export function bodyIdOption(
	displayName: string,
	property: string,
	description?: string,
): INodeProperties {
	return {
		displayName,
		name: property,
		type: 'string',
		default: '',
		placeholder: 'e.g. 12345',
		description,
		routing: {
			send: {
				type: 'body',
				property,
				value: '={{ $value === "" ? undefined : Number($value) }}',
			},
		},
	};
}

/** Date-only body field. Campfire expects `YYYY-MM-DD`, n8n's date picker sends a full timestamp. */
export function bodyDateOption(
	displayName: string,
	property: string,
	description?: string,
): INodeProperties {
	return {
		displayName,
		name: property,
		type: 'dateTime',
		default: '',
		description,
		routing: {
			send: {
				type: 'body',
				property,
				value: '={{ $value ? String($value).slice(0, 10) : undefined }}',
			},
		},
	};
}

/** Date-only query filter. */
export function queryDateOption(
	displayName: string,
	property: string,
	description?: string,
): INodeProperties {
	return {
		displayName,
		name: property,
		type: 'dateTime',
		default: '',
		description,
		routing: {
			send: {
				type: 'query',
				property,
				value: '={{ $value ? String($value).slice(0, 10) : undefined }}',
			},
		},
	};
}

/** Required top-level date field sent as `YYYY-MM-DD`. */
export function requiredDate(
	displayName: string,
	name: string,
	property: string,
	displayOptions: IDisplayOptions,
	description?: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'dateTime',
		default: '',
		required: true,
		description,
		displayOptions,
		routing: {
			send: {
				type: 'body',
				property,
				value: '={{ String($value).slice(0, 10) }}',
			},
		},
	};
}

/** "Last Modified After/Before" filters, for incremental syncs. */
export function lastModifiedFilters(): INodeProperties[] {
	return [
		queryOption(
			{
				displayName: 'Last Modified After',
				name: 'lastModifiedAfter',
				type: 'dateTime',
				default: '',
				description:
					'Only return records changed at or after this time. Useful for incremental syncs.',
			},
			'last_modified_at__gte',
		),
		queryOption(
			{
				displayName: 'Last Modified Before',
				name: 'lastModifiedBefore',
				type: 'dateTime',
				default: '',
				description: 'Only return records changed at or before this time',
			},
			'last_modified_at__lte',
		),
	];
}

/** Options for `POST .../delete`: a reason for the audit log and, where supported, a record to move references to. */
export function deleteOptions(
	displayOptions: IDisplayOptions,
	reassignParameter?: string,
): INodeProperties {
	const options: INodeProperties[] = [
		bodyOption({
			displayName: 'Reason',
			name: 'reason',
			type: 'string',
			default: '',
			description: 'Why the record is deleted. Saved on the audit log entry. Up to 500 characters.',
		}),
	];
	if (reassignParameter) {
		options.push(
			queryOption(
				{
					displayName: 'Move References To (ID)',
					name: 'reassignTo',
					type: 'string',
					default: '',
					placeholder: 'e.g. 12345',
					description:
						'ID of the record that existing transactions should point to instead, before this one is deleted',
				},
				reassignParameter,
			),
		);
	}
	return {
		displayName: 'Options',
		name: 'deleteOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions,
		options: options.sort(byDisplayName),
	};
}

/** Keeps collection entries in the alphabetical order n8n expects. */
export function byDisplayName(a: INodeProperties, b: INodeProperties): number {
	return a.displayName.localeCompare(b.displayName);
}
