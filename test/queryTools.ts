import { expect } from 'chai'
import 'mocha'
import { buildSelectQuery } from '../src/queryTools'
import { schema } from './testSchema'

describe('queryTools', function() {
  describe('buildSelectQuery', function() {
    it('should handle a simple select query', function() {
      let criteria = { column1: 'a', column2: 1 }
      let query = buildSelectQuery(schema, 'table1', criteria)
      expect(query.mysql()).to.equal('SELECT table1.id table1__id, table1.column1 table1__column1, table1.column2 table1__column2 FROM table1 table1 WHERE table1.column1 = ? AND table1.column2 = ?;')
    })
  
    it('should handle inter table relationships', function() {
      let criteria = {
        id: 1,
        column1: 'a',
        many: {
          column1: 'b',
          object2: {
            column1: 'c'
          }
        }
      }
  
      let query = buildSelectQuery(schema, 'table1', criteria)
  
      expect(query._selects.length).to.equal(8)
      expect(query._selects[0]).to.equal('table1.id table1__id')
      expect(query._selects[1]).to.equal('table1.column1 table1__column1')
      expect(query._selects[2]).to.equal('table1.column2 table1__column2')
      expect(query._selects[3]).to.equal('table1__many.table1_id table1__many__table1_id')
      expect(query._selects[4]).to.equal('table1__many.table2_id table1__many__table2_id')
      expect(query._selects[5]).to.equal('table1__many.column1 table1__many__column1')
      expect(query._selects[6]).to.equal('table1__many__object2.id table1__many__object2__id')
      expect(query._selects[7]).to.equal('table1__many__object2.column1 table1__many__object2__column1')
  
      expect(query.mysql()).to.equal('SELECT table1.id table1__id, table1.column1 table1__column1, table1.column2 table1__column2, table1__many.table1_id table1__many__table1_id, table1__many.table2_id table1__many__table2_id, table1__many.column1 table1__many__column1, table1__many__object2.id table1__many__object2__id, table1__many__object2.column1 table1__many__object2__column1 FROM table1 table1 INNER JOIN table_many table1__many ON table1.id = table1__many.table1_id INNER JOIN table2 table1__many__object2 ON table1__many.table2_id = table1__many__object2.id WHERE table1.id = ? AND table1.column1 = ? AND table1__many.column1 = ? AND table1__many__object2.column1 = ?;')
    })
  })
})
