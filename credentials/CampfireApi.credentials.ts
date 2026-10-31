import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CampfireApi implements ICredentialType {
	name = 'campfireApi';

	displayName = 'Campfire API';

	icon: Icon = { light: 'file:../icons/campfire.svg', dark: 'file:../icons/campfire.dark.svg' };

	documentationUrl = 'https://docs.campfire.ai/quickstart';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Create an API user in Campfire under Settings > API Keys, then create a key on that user. The user\'s role sets what the key can do: "admin" for everything (the Campfire Trigger needs it to manage webhooks), "clerk" to read and post drafts, "view only" for reads.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Token {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.meetcampfire.com',
			url: '/coa/api/entity',
			method: 'GET',
		},
	};
}
