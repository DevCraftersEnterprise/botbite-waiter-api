import {
  acceptedTable,
  cleanTables,
} from '@/modules/branches/utils/table.util';

describe('acceptedTable', () => {
  it('accepts any table when the branch has no list', () => {
    expect(acceptedTable('  terraza   2 ', [])).toBe('terraza 2');
  });

  it('returns the table as the branch spells it', () => {
    expect(acceptedTable('a3', ['1', 'A3'])).toBe('A3');
    expect(acceptedTable('terraza  2', ['TERRAZA 2'])).toBe('TERRAZA 2');
  });

  it('rejects a table that is not on the list', () => {
    expect(acceptedTable('99', ['1', 'A3'])).toBeNull();
  });
});

describe('cleanTables', () => {
  it('drops blanks and repeats regardless of case', () => {
    expect(cleanTables([' 1 ', 'A3', 'a3', '', 'Terraza  2'])).toEqual([
      '1',
      'A3',
      'Terraza 2',
    ]);
  });
});
