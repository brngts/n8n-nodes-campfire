import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { PAGE_SIZE } from '../shared/constants';
import { campfireApiRequest } from '../shared/transport';

type Page = { results?: IDataObject[]; next?: string | null } | IDataObject[];

function label(...parts: Array<unknown>): string {
	return parts
		.filter(
			(part): part is string | number =>
				(typeof part === 'string' && part !== '') || typeof part === 'number',
		)
		.map(String)
		.join(' · ');
}

function formatAmount(amount: unknown, currency: unknown): string | undefined {
	const value = Number(amount);
	if (amount === null || amount === undefined || !Number.isFinite(value)) return undefined;
	return `${value.toFixed(2)} ${typeof currency === 'string' ? currency : ''}`.trim();
}

function matches(filter: string | undefined, ...fields: unknown[]): boolean {
	if (!filter) return true;
	const needle = filter.toLowerCase();
	return fields.some(
		(field) =>
			field !== null && field !== undefined && String(field).toLowerCase().includes(needle),
	);
}

/**
 * One page of a Campfire list for a resource picker. Endpoints with a `q`
 * parameter search server-side; the others are filtered on the page that came
 * back, via `localFilter`.
 */
async function search(
	context: ILoadOptionsFunctions,
	endpoint: string,
	qs: IDataObject,
	paginationToken: string | undefined,
	toItem: (record: IDataObject) => INodeListSearchItems,
	localFilter?: (record: IDataObject) => boolean,
): Promise<INodeListSearchResult> {
	const offset = Number(paginationToken ?? 0);
	const page: Page = await campfireApiRequest.call(context, 'GET', endpoint, {
		...qs,
		limit: PAGE_SIZE,
		offset,
	});
	const records = Array.isArray(page) ? page : (page.results ?? []);
	const hasMore = !Array.isArray(page) && typeof page.next === 'string' && page.next !== '';
	return {
		results: (localFilter ? records.filter(localFilter) : records).map(toItem),
		paginationToken: hasMore ? String(offset + records.length) : undefined,
	};
}

function payeeSearch(vendorType?: 'vendor' | 'customer') {
	return async function (
		this: ILoadOptionsFunctions,
		filter?: string,
		paginationToken?: string,
	): Promise<INodeListSearchResult> {
		return await search(
			this,
			'/coa/api/vendor',
			{ q: filter || undefined, vendor_type: vendorType },
			paginationToken,
			(payee) => ({
				name: label(
					String(payee.name ?? payee.id),
					vendorType ? undefined : payee.vendor_type,
					payee.external_id,
				),
				value: String(payee.id),
			}),
		);
	};
}

export const getPayees = payeeSearch();
export const getVendors = payeeSearch('vendor');
export const getCustomers = payeeSearch('customer');

export async function getAccounts(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await search(
		this,
		'/coa/api/account',
		{},
		paginationToken,
		(account) => ({
			name: label(account.number, String(account.name ?? account.id), account.account_type),
			value: String(account.id),
		}),
		(account) => matches(filter, account.name, account.number, account.nickname),
	);
}

export async function getEntities(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const entities = (await campfireApiRequest.call(this, 'GET', '/coa/api/entity')) as IDataObject[];
	return {
		results: (Array.isArray(entities) ? entities : [])
			.filter((entity) => matches(filter, entity.name, entity.currency))
			.map((entity) => ({
				name: label(String(entity.name ?? entity.id), entity.currency),
				value: String(entity.id),
			})),
	};
}

export async function getDepartments(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await search(
		this,
		'/coa/api/department',
		{ q: filter || undefined },
		paginationToken,
		(department) => ({
			name: label(department.code, String(department.name ?? department.id)),
			value: String(department.id),
		}),
	);
}

export async function getDimensions(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await search(this, '/coa/api/tag', { q: filter || undefined }, paginationToken, (tag) => ({
		name: label(String(tag.name ?? tag.id), tag.group_name),
		value: String(tag.id),
	}));
}

export async function getBills(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await search(
		this,
		'/coa/api/v1/bill',
		{ q: filter || undefined, sort: '-bill_date' },
		paginationToken,
		(bill) => ({
			name: label(
				String(bill.bill_number ?? bill.id),
				bill.vendor_name,
				formatAmount(bill.total_amount, bill.currency),
				bill.status,
			),
			value: String(bill.id),
		}),
	);
}

export async function getInvoices(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await search(
		this,
		'/coa/api/v1/invoice',
		{ q: filter || undefined, sort: '-invoice_date' },
		paginationToken,
		(invoice) => ({
			name: label(
				String(invoice.invoice_number ?? invoice.id),
				invoice.client_name,
				formatAmount(invoice.total_amount, invoice.currency),
				invoice.status,
			),
			value: String(invoice.id),
		}),
	);
}

export async function getCreditMemos(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await search(
		this,
		'/coa/api/v1/credit-memo',
		{ q: filter || undefined },
		paginationToken,
		(memo) => ({
			name: label(
				String(memo.credit_memo_number ?? memo.id),
				memo.client_name,
				formatAmount(memo.total_amount, memo.currency),
			),
			value: String(memo.id),
		}),
	);
}

export async function getContracts(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await search(
		this,
		'/rr/api/v1/contracts',
		{},
		paginationToken,
		(contract) => ({
			name: label(String(contract.deal_name ?? contract.id), contract.client_name, contract.status),
			value: String(contract.id),
		}),
		(contract) => matches(filter, contract.deal_name, contract.client_name, contract.deal_id),
	);
}

export async function getProducts(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await search(
		this,
		'/rr/api/v1/product',
		{},
		paginationToken,
		(product) => ({
			name: label(String(product.product_name ?? product.id), product.product_id),
			value: String(product.id),
		}),
		(product) => matches(filter, product.product_name, product.product_id),
	);
}
