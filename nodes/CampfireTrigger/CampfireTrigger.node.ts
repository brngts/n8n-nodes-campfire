import {
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { CAMPFIRE_CREDENTIAL_NAME } from '../Campfire/shared/constants';
import { campfireApiRequest } from '../Campfire/shared/transport';
import { WEBHOOK_TOPICS } from './events';
import { verifyCampfireSignature } from './signature';

const ALL_TOPICS = '*';

const WEBHOOKS_PATH = '/integrations/api/v1/webhook';

type Webhook = {
	id: number;
	url: string;
	token?: string;
	active?: boolean;
	topics?: Array<{ name: string }>;
};

/**
 * A Campfire webhook only receives the topics it subscribes to, so "All
 * Topics" subscribes to every topic this node knows.
 */
export function selectedTopics(selected: unknown): string[] {
	const topics = Array.isArray(selected)
		? selected.filter((topic): topic is string => typeof topic === 'string')
		: [];
	const resolved =
		topics.length === 0 || topics.includes(ALL_TOPICS)
			? WEBHOOK_TOPICS.map((topic) => String(topic.value))
			: topics;
	return [...new Set(resolved)].sort();
}

function sameTopics(webhook: Webhook, topics: string[]): boolean {
	const current = [...new Set((webhook.topics ?? []).map((topic) => topic.name))].sort();
	return (
		current.length === topics.length && current.every((topic, index) => topic === topics[index])
	);
}

function webhookBody(url: string, topics: string[]): IDataObject {
	return { url, active: true, topics: topics.map((name) => ({ name })) };
}

export class CampfireTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Campfire Trigger',
		name: 'campfireTrigger',
		icon: { light: 'file:../../icons/campfire.svg', dark: 'file:../../icons/campfire.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle:
			'={{$parameter["topics"].includes("*") ? "All topics" : $parameter["topics"].join(", ")}}',
		description:
			'Starts the workflow when a bill, invoice, journal entry, memo or contract changes in Campfire',
		defaults: {
			name: 'Campfire Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: CAMPFIRE_CREDENTIAL_NAME,
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'The API key must belong to an admin user, since only admins can manage webhooks in Campfire',
				name: 'adminNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Topics',
				name: 'topics',
				type: 'multiOptions',
				options: [
					{
						name: 'All Topics',
						value: ALL_TOPICS,
						description: 'Every topic listed here',
					},
					...WEBHOOK_TOPICS,
				],
				default: [],
				required: true,
				description:
					'Which Campfire events start the workflow. "Payment" topics fire on every payment, including partial ones; "Paid" topics fire once the record is fully paid.',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) return false;
				const webhookData = this.getWorkflowStaticData('node');
				const topics = selectedTopics(this.getNodeParameter('topics'));

				const webhooks = (await campfireApiRequest.call(this, 'GET', WEBHOOKS_PATH)) as Webhook[];
				const existing = (Array.isArray(webhooks) ? webhooks : []).find(
					(webhook) => webhook.url === webhookUrl,
				);
				if (!existing) return false;

				// Campfire returns the signing secret on every read, so a webhook for this
				// URL can be adopted even if this node did not create it.
				webhookData.webhookId = existing.id;
				if (typeof existing.token === 'string') webhookData.webhookSecret = existing.token;

				if (existing.active !== false && sameTopics(existing, topics)) return true;

				// Updating topics replaces the whole set, so the full list is sent.
				const updated = (await campfireApiRequest.call(
					this,
					'PUT',
					`${WEBHOOKS_PATH}/${existing.id}`,
					{},
					webhookBody(webhookUrl, topics),
				)) as Webhook;
				if (typeof updated.token === 'string') webhookData.webhookSecret = updated.token;
				return true;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) return false;
				const webhookData = this.getWorkflowStaticData('node');
				const topics = selectedTopics(this.getNodeParameter('topics'));

				const response = (await campfireApiRequest.call(
					this,
					'POST',
					WEBHOOKS_PATH,
					{},
					webhookBody(webhookUrl, topics),
				)) as Webhook;

				if (response.id === undefined || typeof response.token !== 'string') return false;
				webhookData.webhookId = response.id;
				webhookData.webhookSecret = response.token;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId === undefined) return true;

				try {
					await campfireApiRequest.call(
						this,
						'DELETE',
						`${WEBHOOKS_PATH}/${String(webhookData.webhookId)}`,
					);
				} catch (error) {
					this.logger.warn(`Could not delete Campfire webhook ${String(webhookData.webhookId)}`, {
						error: error instanceof Error ? error.message : String(error),
					});
					return false;
				}

				delete webhookData.webhookId;
				delete webhookData.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const secret = this.getWorkflowStaticData('node').webhookSecret;
		const headers = this.getHeaderData();

		const isValid =
			typeof secret === 'string' &&
			verifyCampfireSignature({
				secret,
				rawBody: request.rawBody ?? '',
				timestampHeader: headers['campfire-webhook-request-timestamp'],
				signatureHeader: headers['campfire-webhook-signature-v1'],
			});

		if (!isValid) {
			this.getResponseObject().status(401).send('Invalid signature').end();
			return { noWebhookResponse: true };
		}

		const body: IDataObject = this.getBodyData();
		return {
			workflowData: [this.helpers.returnJsonArray(body)],
		};
	}
}
