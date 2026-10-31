import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import {
	getAccounts,
	getBills,
	getContracts,
	getCreditMemos,
	getCustomers,
	getDepartments,
	getDimensions,
	getEntities,
	getInvoices,
	getPayees,
	getProducts,
	getVendors,
} from './listSearch';
import { accountDescription } from './resources/account';
import { billDescription } from './resources/bill';
import { contractDescription } from './resources/contract';
import { creditMemoDescription } from './resources/creditMemo';
import { departmentDescription } from './resources/department';
import { dimensionDescription } from './resources/dimension';
import { entityDescription } from './resources/entity';
import { fileDescription } from './resources/file';
import { invoiceDescription } from './resources/invoice';
import { journalEntryDescription } from './resources/journalEntry';
import { payeeDescription } from './resources/payee';
import { productDescription } from './resources/product';
import { reportDescription } from './resources/report';
import { subscriptionDescription } from './resources/subscription';
import { API_BASE_URL, CAMPFIRE_CREDENTIAL_NAME } from './shared/constants';

export class Campfire implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Campfire',
		name: 'campfire',
		icon: { light: 'file:../../icons/campfire.svg', dark: 'file:../../icons/campfire.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Manage bills, invoices, journal entries, contracts and master data in the Campfire ERP',
		defaults: {
			name: 'Campfire',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: CAMPFIRE_CREDENTIAL_NAME,
				required: true,
			},
		],
		requestDefaults: {
			baseURL: API_BASE_URL,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account', description: 'Chart of accounts' },
					{ name: 'Bill', value: 'bill', description: 'Vendor bills (accounts payable)' },
					{ name: 'Contract', value: 'contract', description: 'Revenue recognition contracts' },
					{ name: 'Credit Memo', value: 'creditMemo' },
					{
						name: 'Custom Dimension',
						value: 'dimension',
						description: 'Tags such as cost center or channel',
					},
					{ name: 'Department', value: 'department' },
					{ name: 'Entity', value: 'entity', description: 'Legal entities' },
					{
						name: 'File',
						value: 'file',
						description: 'Attachments on bills, invoices and other records',
					},
					{
						name: 'Invoice',
						value: 'invoice',
						description: 'Customer invoices (accounts receivable)',
					},
					{ name: 'Journal Entry', value: 'journalEntry' },
					{ name: 'Payee', value: 'payee', description: 'Vendors, customers and employees' },
					{
						name: 'Product',
						value: 'product',
						description: 'Products used on invoices and contracts',
					},
					{ name: 'Report', value: 'report', description: 'Financial statements' },
					{
						name: 'Subscription',
						value: 'subscription',
						description: 'Subscriptions within a contract',
					},
				],
				default: 'bill',
			},
			...accountDescription,
			...billDescription,
			...contractDescription,
			...creditMemoDescription,
			...dimensionDescription,
			...departmentDescription,
			...entityDescription,
			...fileDescription,
			...invoiceDescription,
			...journalEntryDescription,
			...payeeDescription,
			...productDescription,
			...reportDescription,
			...subscriptionDescription,
		],
	};

	methods = {
		listSearch: {
			getAccounts,
			getBills,
			getContracts,
			getCreditMemos,
			getCustomers,
			getDepartments,
			getDimensions,
			getEntities,
			getInvoices,
			getPayees,
			getProducts,
			getVendors,
		},
	};
}
