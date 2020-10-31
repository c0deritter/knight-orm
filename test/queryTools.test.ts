import { expect } from 'chai'
import 'mocha'
import { buildSelectQuery } from '../src/queryTools'
import { schema } from './testSchema'

describe('queryTools', function() {
  describe('buildSelectQuery', function() {
    it('should handle a simple select query', function() {
      let criteria = { column1: 'a', column2: 1 }
      let query = buildSelectQuery(schema, 'table1', criteria)
      expect(query.mysql()).to.equal('SELECT table1.id "table1__id", table1.column1 "table1__column1", table1.column2 "table1__column2", table1.table1_id "table1__table1_id", table1.table2_id "table1__table2_id" FROM table1 table1 WHERE table1.column1 = ? AND table1.column2 = ?;')
    })
  
    it('should handle inter table relationships', function() {
      let criteria = {
        id: 1,
        column1: 'a',
        manyObjects: {
          '@filterGlobally': true,
          column1: 'b',
          object2: {
            '@filterGlobally': true,
            column1: 'c'
          }
        }
      }
  
      let query = buildSelectQuery(schema, 'table1', criteria)
  
      expect(query._selects.length).to.equal(12)
      expect(query._selects[0]).to.equal('table1.id "table1__id"')
      expect(query._selects[1]).to.equal('table1.column1 "table1__column1"')
      expect(query._selects[2]).to.equal('table1.column2 "table1__column2"')
      expect(query._selects[3]).to.equal('table1.table1_id "table1__table1_id"')
      expect(query._selects[4]).to.equal('table1.table2_id "table1__table2_id"')
      expect(query._selects[5]).to.equal('table1__manyObjects.table1_id "table1__manyObjects__table1_id"')
      expect(query._selects[6]).to.equal('table1__manyObjects.table2_id "table1__manyObjects__table2_id"')
      expect(query._selects[7]).to.equal('table1__manyObjects.column1 "table1__manyObjects__column1"')
      expect(query._selects[8]).to.equal('table1__manyObjects.table1_id2 "table1__manyObjects__table1_id2"')
      expect(query._selects[9]).to.equal('table1__manyObjects__object2.id "table1__manyObjects__object2__id"')
      expect(query._selects[10]).to.equal('table1__manyObjects__object2.column1 "table1__manyObjects__object2__column1"')
      expect(query._selects[11]).to.equal('table1__manyObjects__object2.table1_id "table1__manyObjects__object2__table1_id"')
  
      expect(query.mysql()).to.equal('SELECT table1.id "table1__id", table1.column1 "table1__column1", table1.column2 "table1__column2", table1.table1_id "table1__table1_id", table1.table2_id "table1__table2_id", table1__manyObjects.table1_id "table1__manyObjects__table1_id", table1__manyObjects.table2_id "table1__manyObjects__table2_id", table1__manyObjects.column1 "table1__manyObjects__column1", table1__manyObjects.table1_id2 "table1__manyObjects__table1_id2", table1__manyObjects__object2.id "table1__manyObjects__object2__id", table1__manyObjects__object2.column1 "table1__manyObjects__object2__column1", table1__manyObjects__object2.table1_id "table1__manyObjects__object2__table1_id" FROM table1 table1 LEFT JOIN table_many table1__manyObjects ON table1.id = table1__manyObjects.table1_id LEFT JOIN table2 table1__manyObjects__object2 ON table1__manyObjects.table2_id = table1__manyObjects__object2.id WHERE table1.id = ? AND table1.column1 = ? AND table1__manyObjects.column1 = ? AND table1__manyObjects__object2.column1 = ?;')
    })
  })
})
