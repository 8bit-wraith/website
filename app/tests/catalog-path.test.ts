import fs from 'fs';
import { NextRequest } from 'next/server';
import path from 'path';
import { beforeEach, expect, it, vi } from 'vitest';

import { GET } from '@mcpCatalog/api/server/[name]/route';
import { clearServersCache, loadServers } from '@mcpCatalog/lib/catalog';

vi.mock('fs', () => ({
  default: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => '["https://github.com/owner/repo"]') },
}));
vi.mock('@constants', () => ({ default: { debug: false } }));

beforeEach(() => {
  clearServersCache();
  vi.clearAllMocks();
});

for (const name of ['../outside', 'nested/name', '..\\outside', 'name\0bad']) {
  it(`rejects unsafe name ${JSON.stringify(name)} before filesystem access`, () => {
    expect(loadServers(name)).toEqual([]);
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });
}

it('retains valid catalog lookup', () => {
  expect(loadServers('owner__repo')[0].name).toBe('owner__repo');
  expect(fs.existsSync).toHaveBeenCalledWith(
    path.join(process.cwd(), 'app/mcp-catalog/data/mcp-evaluations/owner__repo.json')
  );
});

it('retains full catalog lookup', () => {
  expect(loadServers()).toHaveLength(1);
});

it('returns HTTP 404 for traversal input without filesystem access', async () => {
  const response = await GET(new NextRequest('http://localhost/api/server/invalid'), {
    params: Promise.resolve({ name: '../outside' }),
  });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'Server not found' });
  expect(fs.existsSync).not.toHaveBeenCalled();
  expect(fs.readFileSync).not.toHaveBeenCalled();
});

it('returns HTTP 200 for a valid placeholder without inventing configuration', async () => {
  const response = await GET(new NextRequest('http://localhost/api/server/owner__repo'), {
    params: Promise.resolve({ name: 'owner__repo' }),
  });
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.name).toBe('owner__repo');
  expect(body.archestra_config).toBeNull();
  expect(body.user_config).toBeNull();
});
