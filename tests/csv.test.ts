import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForCsvFormulaInjection, exportToCsv, parseCsv } from '../src/lib/csv';

test('CSV formula injection defense prefixes dangerous characters', () => {
  assert.equal(sanitizeForCsvFormulaInjection('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.equal(sanitizeForCsvFormulaInjection('+12345'), "'+12345");
  assert.equal(sanitizeForCsvFormulaInjection('-500'), "'-500");
  assert.equal(sanitizeForCsvFormulaInjection('@EVIL'), "'@EVIL");
  assert.equal(sanitizeForCsvFormulaInjection('Normal text'), 'Normal text');
});

test('CSV export and parse handles special characters, commas, and quotes', () => {
  const data = [
    { id: '1', name: 'Otoro Nigiri', price: 42000, desc: 'Fresh tuna, 2 pcs' },
    { id: '2', name: 'Wagyu A5 "Special"', price: 85000, desc: 'Robata grilled\nwith truffle' },
    { id: '3', name: '=CMD()', price: 10000, desc: 'Formula attack' },
  ];

  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { key: 'price', header: 'Price' },
    { key: 'desc', header: 'Description' },
  ];

  const csv = exportToCsv(data, columns);
  assert.ok(csv.includes('"Wagyu A5 ""Special"""'));
  assert.ok(csv.includes("'=CMD()"));

  const parsed = parseCsv(csv);
  assert.equal(parsed.headers.length, 4);
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[0].Name, 'Otoro Nigiri');
  assert.equal(parsed.rows[1].Name, 'Wagyu A5 "Special"');
  // Formula injection prefix was stripped on safe read
  assert.equal(parsed.rows[2].Name, '=CMD()');
});
