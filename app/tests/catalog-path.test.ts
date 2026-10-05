import fs from 'fs';
import path from 'path';
import { beforeEach, expect, it, vi } from 'vitest';

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
