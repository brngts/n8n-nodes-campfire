import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { API_BASE_URL, CAMPFIRE_CREDENTIAL_NAME } from './constants';
import { toCampfireError } from './errors';

/**
 * Authenticated request helper for code paths outside declarative routing:
 * list search, the trigger's webhook lifecycle and lookups made inside preSend
 * and postReceive functions.
 */
export async function campfireApiRequest(
	this: ILoadOptionsFunctions | IHookFunctions | IExecuteSingleFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	qs: IDataObject = {},
	body?: IDataObject,
) {
	const options: IHttpRequestOptions = {
		method,
		qs,
		body,
		url: `${API_BASE_URL}${endpoint}`,
		json: true,
	};

	try {
		return await this.helpers.httpRequestWithAuthentication.call(
			this,
			CAMPFIRE_CREDENTIAL_NAME,
			options,
		);
	} catch (error) {
		throw toCampfireError(this.getNode(), error);
	}
}
