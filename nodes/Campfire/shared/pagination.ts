import type { IDataObject, IN8nRequestOperationPaginationGeneric } from 'n8n-workflow';
import { PAGE_SIZE } from './constants';

/**
 * n8n replaces the whole query string with the one given here on every
 * paginated request, so each query parameter the operation may send has to be
 * carried over from `$request.qs` explicitly. Parameters that are not set
 * resolve to undefined and are dropped from the URL.
 */
function carryOver(queryParameters: string[]): IDataObject {
	const qs: IDataObject = {};
	for (const parameter of queryParameters) {
		qs[parameter] = `={{ $request.qs?.${parameter} }}`;
	}
	return qs;
}

/**
 * Campfire lists page with `limit` and `offset` and answer
 * `{ count, next, previous, results }`, where `next` is the URL of the next
 * page or null on the last one. The next offset is read from that URL.
 *
 * n8n evaluates `request` before the first page too, with an empty
 * `$response`, so the offset there must come out as 0.
 */
export function offsetPagination(queryParameters: string[]): IN8nRequestOperationPaginationGeneric {
	return {
		type: 'generic',
		properties: {
			continue: '={{ typeof $response.body?.next === "string" && $response.body.next !== "" }}',
			request: {
				qs: {
					...carryOver(queryParameters),
					limit: PAGE_SIZE,
					offset:
						'={{ typeof $response.body?.next === "string" && $response.body.next.includes("offset=") ? Number($response.body.next.split("offset=")[1].split("&")[0]) : 0 }}',
				},
			},
		},
	};
}
