import { searchChunks } from '../vectorSearch';
import type { Pool } from 'pg';

function makeMockDb(rows: object[] = []): Pool {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as Pool;
}

describe('searchChunks', () => {
  it('queries with the regulation name as an ILIKE parameter', async () => {
    const db = makeMockDb();
    await searchChunks(db, 'GDPR', 'All roles');
    const call = (db.query as jest.Mock).mock.calls[0];
    expect(call[1][0]).toBe('GDPR');
  });

  it('includes regulation and role in the full-text search parameter', async () => {
    const db = makeMockDb();
    await searchChunks(db, 'AML', 'Compliance Officer');
    const call = (db.query as jest.Mock).mock.calls[0];
    const ftsParam: string = call[1][1];
    expect(ftsParam).toContain('AML');
    expect(ftsParam).toContain('Compliance Officer');
  });

  it('returns the rows from the db result', async () => {
    const fakeChunks = [
      { id: '1', regulation_name: 'GDPR', article_reference: 'Article 5', content: 'test' },
    ];
    const db = makeMockDb(fakeChunks);
    const result = await searchChunks(db, 'GDPR', 'All roles');
    expect(result).toEqual(fakeChunks);
  });

  it('propagates errors thrown by the db', async () => {
    const db = {
      query: jest.fn().mockRejectedValue(new Error('DB down')),
    } as unknown as Pool;
    await expect(searchChunks(db, 'GDPR', 'All roles')).rejects.toThrow('DB down');
  });

  it('returns an empty array when the db returns no rows', async () => {
    const db = makeMockDb([]);
    const result = await searchChunks(db, 'KYC', 'Customer Service');
    expect(result).toEqual([]);
  });
});
