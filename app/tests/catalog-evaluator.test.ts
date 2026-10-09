import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { evaluateSingleRepo } from '@mcpCatalog/scripts/evaluate-catalog';
import { MCP_SERVERS_EVALUATIONS_DIR } from '@mcpCatalog/scripts/paths';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

const previous = {
  name: 'fixture-owner__fixture-repo',
  description: 'Synthetic catalog entry',
  readme: 'Synthetic configuration documentation',
  server: {
    type: 'node',
    entry_point: 'previous.js',
    mcp_config: { command: 'node', args: ['previous.js'] },
  },
  user_config: {
    directory: { type: 'directory', title: 'Directory', description: 'Synthetic workspace', required: true },
  },
  evaluation_model: 'previous-model',
  quality_score: 42,
};

const valid = {
  server: {
    type: 'node',
    entry_point: 'updated.js',
    mcp_config: { command: 'node', args: ['updated.js'] },
  },
  user_config: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(previous));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubEnv('GEMINI_API_KEY', 'synthetic-test-key');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

for (const model of ['offline-fixture', 'gemini-offline-fixture']) {
  describe(`canonical configuration through ${model}`, () => {
    async function evaluate(response: unknown) {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () =>
          model.startsWith('gemini-')
            ? { candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }] }
            : { response: JSON.stringify(response) },
      }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await evaluateSingleRepo('https://github.com/fixture-owner/fixture-repo', {
        force: true,
        updateCanonicalServerAndUserConfig: true,
        model,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(MCP_SERVERS_EVALUATIONS_DIR, 'fixture-owner__fixture-repo.json'),
        JSON.stringify(result, null, 2)
      );
      return result;
    }

    it.each([
      ['missing server fields', { server: { mcp_config: valid.server.mcp_config }, user_config: {} }],
      ['unknown server type', { ...valid, server: { ...valid.server, type: 'unknown' } }],
      ['non-string command', { ...valid, server: { ...valid.server, mcp_config: { command: 17 } } }],
      ['invalid user option', { ...valid, user_config: { directory: { type: 'not-an-option' } } }],
      ['missing user configuration', { server: valid.server }],
      ['null server', { ...valid, server: null }],
    ])('preserves the stored configuration for %s', async (_label, response) => {
      expect(await evaluate(response)).toEqual(previous);
    });

    it('saves valid configuration while preserving unrelated catalog metadata', async () => {
      expect(await evaluate(valid)).toEqual({ ...previous, ...valid, evaluation_model: model });
    });
  });
}
