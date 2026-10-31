import type {
	IHttpRequestMethods,
	INodeProperties,
	INodePropertyOptions,
	PostReceiveAction,
} from 'n8n-workflow';
import { handleCampfireError, returnSuccess } from './postReceive';

type OperationOptions = {
	name: string;
	value: string;
	action: string;
	description: string;
	method: IHttpRequestMethods;
	url: string;
	/** `list` unwraps the `results` array of a list response into one item per record. */
	output?: 'record' | 'list' | 'success' | PostReceiveAction[];
	request?: Record<string, unknown>;
};

/**
 * One operation of a resource. Every request sets `ignoreHttpStatusErrors` so
 * `handleCampfireError` can surface Campfire's own message.
 */
export function operation({
	name,
	value,
	action,
	description,
	method,
	url,
	output = 'record',
	request = {},
}: OperationOptions): INodePropertyOptions {
	let postReceive: PostReceiveAction[];
	if (output === 'list') {
		postReceive = [
			handleCampfireError,
			{ type: 'rootProperty', properties: { property: 'results' } },
		];
	} else if (output === 'success') {
		postReceive = [handleCampfireError, returnSuccess];
	} else if (output === 'record') {
		postReceive = [handleCampfireError];
	} else {
		postReceive = [handleCampfireError, ...output];
	}

	return {
		name,
		value,
		action,
		description,
		routing: {
			request: {
				method,
				url,
				ignoreHttpStatusErrors: true,
				...request,
			},
			output: { postReceive },
		},
	};
}

/** The "Operation" dropdown for a resource. */
export function operationSelector(
	resource: string,
	options: INodePropertyOptions[],
	defaultOperation: string,
): INodeProperties {
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [resource] } },
		options,
		default: defaultOperation,
	};
}

type CrudOptions = {
	/** Lower-case singular name used in actions, such as "department" */
	singular: string;
	/** Lower-case plural name used in descriptions, such as "departments" */
	plural: string;
	/** Collection path, such as `/coa/api/department` */
	path: string;
	/** Node parameter holding the record ID */
	idParameter: string;
	/** Most records are deleted with `POST {path}/{id}/delete`; files still use `DELETE {path}/{id}`. */
	deleteMethod?: 'post' | 'delete';
	/** Operations to leave out, for records the API cannot create or delete */
	omit?: Array<'create' | 'delete' | 'update'>;
};

function article(word: string): string {
	return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** Create, Delete, Get, Get Many and Update for a record with a plain REST collection. */
export function crudOperations({
	singular,
	plural,
	path,
	idParameter,
	deleteMethod = 'post',
	omit = [],
}: CrudOptions): INodePropertyOptions[] {
	const one = `${article(singular)} ${singular}`;
	const recordUrl = `=${path}/{{$parameter.${idParameter}}}`;
	const operations: INodePropertyOptions[] = [
		operation({
			name: 'Create',
			value: 'create',
			action: `Create ${one}`,
			description: `Create ${one}`,
			method: 'POST',
			url: path,
		}),
		operation({
			name: 'Delete',
			value: 'delete',
			action: `Delete ${one}`,
			description: `Delete ${one}`,
			method: deleteMethod === 'post' ? 'POST' : 'DELETE',
			url: deleteMethod === 'post' ? `${recordUrl}/delete` : recordUrl,
			output: 'success',
		}),
		operation({
			name: 'Get',
			value: 'get',
			action: `Get ${one}`,
			description: `Get ${one} by ID`,
			method: 'GET',
			url: recordUrl,
		}),
		operation({
			name: 'Get Many',
			value: 'getAll',
			action: `Get many ${plural}`,
			description: `List ${plural}`,
			method: 'GET',
			url: path,
			output: 'list',
		}),
		operation({
			name: 'Update',
			value: 'update',
			action: `Update ${one}`,
			description: `Change fields of ${one}`,
			method: 'PATCH',
			url: recordUrl,
		}),
	];
	return operations.filter(
		(option) => !omit.includes(option.value as 'create' | 'delete' | 'update'),
	);
}
