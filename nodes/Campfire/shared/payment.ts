import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';
import { recordLocator } from './descriptions';
import { sendManualPayment } from './preSend';

/**
 * Fields for "Mark as Paid" on bills and invoices. They describe one manual
 * payment, sent as `empty_transactions`. Matching a bank transaction, or
 * applying credit memos, goes through the JSON field instead.
 */
export function paymentProperties(
	displayOptions: IDisplayOptions,
	record: 'bill' | 'invoice',
): INodeProperties[] {
	return [
		{
			...recordLocator({
				name: 'paymentAccount',
				displayName: 'Payment Account',
				searchListMethod: 'getAccounts',
				displayOptions,
				description:
					record === 'bill'
						? 'The cash or clearing account the bill was paid from'
						: 'The cash or clearing account the payment was received into',
			}),
			routing: { send: { preSend: [sendManualPayment] } },
		},
		{
			displayName: 'Amount',
			name: 'amount',
			type: 'number',
			typeOptions: { numberPrecision: 2 },
			default: 0,
			required: true,
			description: `Amount paid, in major units of the ${record} currency. Less than the amount due records a partial payment.`,
			displayOptions,
		},
		{
			displayName: 'Payment Date',
			name: 'paymentDate',
			type: 'dateTime',
			default: '',
			required: true,
			displayOptions,
		},
		{
			displayName: 'Options',
			name: 'paymentOptions',
			type: 'collection',
			placeholder: 'Add Option',
			default: {},
			displayOptions,
			options: [
				{
					displayName: 'Currency',
					name: 'currency',
					type: 'string',
					default: '',
					placeholder: 'e.g. EUR',
					description: `Currency of the payment, when it differs from the ${record} currency`,
				},
				{
					displayName: 'Custom Dimension IDs',
					name: 'dimensions',
					type: 'string',
					default: '',
					placeholder: 'e.g. 7737, 8330',
					description: 'Comma-separated custom dimension (tag) IDs for the payment line',
				},
				{
					displayName: 'Department ID',
					name: 'department',
					type: 'string',
					default: '',
				},
				{
					displayName: 'External ID',
					name: 'externalId',
					type: 'string',
					default: '',
					description: 'Payment reference in the source system, such as a bank transfer ID',
				},
				{
					displayName: 'Memo',
					name: 'memo',
					type: 'string',
					default: '',
				},
			],
		},
	];
}
