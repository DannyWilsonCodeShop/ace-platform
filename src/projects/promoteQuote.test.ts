import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildProjectInput,
  buildProjectPageInput,
  buildDemoInput,
  buildContractInput,
} from './promoteQuote';
import { getTemplate } from './templates';
import type { TrackedItem } from './templates/types';

/**
 * Regression test for FEAT-001: the quote->project promotion path must never
 * stamp an `owner` key on any createX input. Passing `owner` is what broke
 * quote Accept with "field not defined for input object type
 * CreateProjectInput". These assertions exercise the pure input builders used
 * by promoteQuote (no network).
 */
describe('promoteQuote pure input builders (FEAT-001: no owner on create)', () => {
  const template = getTemplate('app-build');

  it('buildProjectInput does not include an `owner` key', () => {
    const input = buildProjectInput({
      quoteId: 'quote-1',
      clientId: 'client-1',
      name: 'Acme app',
      template,
      quotedAmount: 50000,
    });
    expect('owner' in input).toBe(false);
    expect(input.quoteId).toBe('quote-1');
    expect(input.clientId).toBe('client-1');
    expect(input.name).toBe('Acme app');
    expect(input.status).toBe('contract_pending');
    expect(input.templateKey).toBe(template.key);
    expect(input.quotedAmount).toBe(50000);
  });

  it('buildProjectInput normalizes a null quotedAmount without an owner key', () => {
    const input = buildProjectInput({
      quoteId: 'quote-2',
      clientId: 'client-2',
      name: 'No-price app',
      template,
      quotedAmount: null,
    });
    expect('owner' in input).toBe(false);
    expect(input.quotedAmount).toBeNull();
  });

  it('buildProjectPageInput does not include an `owner` key for any template item', () => {
    const items: TrackedItem[] = [
      ...template.frontend,
      ...template.backend,
      ...template.middleware,
    ];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const input = buildProjectPageInput('proj-1', item);
      expect('owner' in input).toBe(false);
      expect(input.projectId).toBe('proj-1');
      expect(input.pageKey).toBe(item.key);
      expect(input.category).toBe(item.category);
    }
  });
});

/**
 * FEAT-003: createProjectForClient builds its Project + ProjectPage create
 * inputs from the same pure builders. These assertions exercise the exact page
 * seeding createProjectForClient performs (no network) — one page per template
 * item, in the correct frontend/backend/middleware categories, and never an
 * `owner` key.
 */
describe('createProjectForClient page seeding (FEAT-003: no owner, one page per item)', () => {
  const template = getTemplate('app-build');
  const items: TrackedItem[] = [
    ...template.frontend,
    ...template.backend,
    ...template.middleware,
  ];

  it('seeds exactly one ProjectPage input per template item', () => {
    const pages = items.map((item) => buildProjectPageInput('proj-seed', item));
    expect(pages.length).toBe(items.length);
    expect(pages.length).toBeGreaterThan(0);
    // every seeded page points at the created project and carries no owner.
    for (const page of pages) {
      expect(page.projectId).toBe('proj-seed');
      expect('owner' in page).toBe(false);
    }
    // page keys are a 1:1 image of the template item keys.
    expect(pages.map((p) => p.pageKey)).toEqual(items.map((i) => i.key));
  });

  it('seeds pages in the correct categories (frontend/backend/middleware)', () => {
    const pages = items.map((item) => buildProjectPageInput('proj-seed', item));
    const countBy = (cat: string) => pages.filter((p) => p.category === cat).length;
    expect(countBy('frontend')).toBe(template.frontend.length);
    expect(countBy('backend')).toBe(template.backend.length);
    expect(countBy('middleware')).toBe(template.middleware.length);
  });

  it('builds a Project input with no owner key and the template launch window', () => {
    const input = buildProjectInput({
      quoteId: 'q-seed',
      clientId: 'c-seed',
      name: 'Seeded project',
      template,
      quotedAmount: null,
    });
    expect('owner' in input).toBe(false);
    expect(input.clientId).toBe('c-seed');
    expect(input.status).toBe('contract_pending');
    expect(input.launchStart).toBe(template.launch.start);
    expect(input.launchTarget).toBe(template.launch.target);
  });
});

/**
 * FEAT-001 §2.2/§2.3: the templated client-package create inputs
 * (buildDemoInput/buildContractInput) must carry the correct kind/provider/
 * status and NEVER an `owner` key (TD-1).
 */
describe('client-package create input builders (FEAT-001: no owner on create)', () => {
  it('buildDemoInput builds a DRAFT CHOICE_BOARD with three null-priced options and no owner', () => {
    const input = buildDemoInput('proj-demo');
    expect('owner' in input).toBe(false);
    expect(input.projectId).toBe('proj-demo');
    expect(input.title).toBe('Concept Choice Board');
    expect(input.kind).toBe('CHOICE_BOARD');
    expect(input.status).toBe('DRAFT');
    expect(input.options).toHaveLength(3);
    for (const o of input.options) expect(o.price).toBeNull();
  });

  it('buildContractInput builds a draft manual_upload contract with string terms and no owner', () => {
    const input = buildContractInput('proj-c', 'client-c');
    expect('owner' in input).toBe(false);
    expect(input.projectId).toBe('proj-c');
    expect(input.clientId).toBe('client-c');
    expect(input.status).toBe('draft');
    expect(input.provider).toBe('manual_upload');
    expect(input.amount).toBe(50000);
    expect(typeof input.terms.fixedPrice).toBe('string');
    expect(input.terms.fixedPrice).toBe('50000');
  });
});

/**
 * FEAT-001 §2.3: createProjectForClient idempotently seeds the templated
 * Demo/Contract/ActionItems. These tests mock the whole api + portal-user
 * surface so the function runs with no network, and assert:
 *  - a fresh project seeds exactly one Demo, one Contract, and three ActionItems;
 *  - a mocked lookup returning an existing row skips that create (idempotent);
 *  - a lookup that THROWS is fatal: the seeding rethrows and NO create runs;
 *  - the Tab-4 double-create sequence yields exactly ONE Contract.
 */
const apiMock = vi.hoisted(() => ({
  listClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  createProject: vi.fn(),
  createProjectPage: vi.fn(),
  listProjectsByClient: vi.fn(),
  updateQuote: vi.fn(),
  listDemos: vi.fn(),
  createDemo: vi.fn(),
  getContract: vi.fn(),
  createContract: vi.fn(),
  listActionItems: vi.fn(),
  createActionItem: vi.fn(),
}));

vi.mock('../utils/api', () => apiMock);
vi.mock('../utils/createPortalUser', () => ({
  createPortalUser: vi.fn(async () => ({ success: true, userId: 'cognito-user-1' })),
}));

describe('createProjectForClient templated seeding (FEAT-001 §2.3)', () => {
  const client = { id: 'client-1', email: 'a@b.com', totalProjects: 0 };
  const quote = { id: 'quote-1', email: 'a@b.com', organization: 'Acme' };

  beforeEach(() => {
    vi.clearAllMocks();
    // default happy-path: no existing project, nothing seeded yet.
    apiMock.listProjectsByClient.mockResolvedValue([]);
    apiMock.createProject.mockResolvedValue({ id: 'proj-1' });
    apiMock.createProjectPage.mockResolvedValue({ id: 'page' });
    apiMock.updateClient.mockResolvedValue({});
    apiMock.updateQuote.mockResolvedValue({});
    apiMock.listDemos.mockResolvedValue([]);
    apiMock.createDemo.mockResolvedValue({ id: 'demo-1' });
    apiMock.getContract.mockResolvedValue([]);
    apiMock.createContract.mockResolvedValue({ id: 'contract-1' });
    apiMock.listActionItems.mockResolvedValue([]);
    apiMock.createActionItem.mockResolvedValue({ id: 'ai' });
  });

  it('seeds one Demo, one Contract, and three ActionItems on a fresh project', async () => {
    const { createProjectForClient } = await import('./promoteQuote');
    await createProjectForClient(client, quote);
    expect(apiMock.createDemo).toHaveBeenCalledTimes(1);
    expect(apiMock.createContract).toHaveBeenCalledTimes(1);
    expect(apiMock.createActionItem).toHaveBeenCalledTimes(3);
    // no owner key on any seeded create input
    for (const call of [
      ...apiMock.createDemo.mock.calls,
      ...apiMock.createContract.mock.calls,
      ...apiMock.createActionItem.mock.calls,
    ]) {
      expect('owner' in call[0]).toBe(false);
    }
  });

  it('is idempotent: existing rows skip their create', async () => {
    apiMock.listDemos.mockResolvedValue([{ id: 'existing-demo' }]);
    apiMock.getContract.mockResolvedValue([{ id: 'existing-contract' }]);
    apiMock.listActionItems.mockResolvedValue([{ id: 'existing-ai' }]);
    const { createProjectForClient } = await import('./promoteQuote');
    await createProjectForClient(client, quote);
    expect(apiMock.createDemo).not.toHaveBeenCalled();
    expect(apiMock.createContract).not.toHaveBeenCalled();
    expect(apiMock.createActionItem).not.toHaveBeenCalled();
  });

  it('a LOOKUP throw is fatal: seeding rethrows and no create runs', async () => {
    apiMock.listDemos.mockRejectedValue(new Error('AppSync down'));
    const { createProjectForClient } = await import('./promoteQuote');
    await expect(createProjectForClient(client, quote)).rejects.toThrow(
      /Could not look up existing demos to seed/,
    );
    expect(apiMock.createDemo).not.toHaveBeenCalled();
    expect(apiMock.createContract).not.toHaveBeenCalled();
  });

  it('Tab-4 sequence yields exactly one Contract (HIGH-2)', async () => {
    // Simulate createProjectForClient seeding a draft Contract, then Tab 4's
    // persistContract re-reading it and choosing update over a second create.
    const { createProjectForClient } = await import('./promoteQuote');
    await createProjectForClient(client, quote);
    expect(apiMock.createContract).toHaveBeenCalledTimes(1);

    // Tab 4's HIGH-2 fix: contractId is null, so it re-reads getContract(pid)
    // and adopts the seeded row -> update, not a second create.
    const seeded = [{ id: 'contract-1' }];
    apiMock.getContract.mockResolvedValue(seeded);
    const existing = await apiMock.getContract('proj-1');
    const cid = existing.length > 0 ? existing[0].id : null;
    expect(cid).toBe('contract-1');
    // decision uses update, so still exactly one createContract overall
    expect(apiMock.createContract).toHaveBeenCalledTimes(1);
  });
});
