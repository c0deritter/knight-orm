import { expect } from 'chai'
import 'mocha'
import { ObjectTools, Orm } from '../../src'
import { ManyToManyObject2, Object1, schema } from '../testSchema'

let objectTools = new ObjectTools(new Orm(schema, 'postgres'))

describe('ObjectTools', function() {
  describe('isAtLeastOneNotPrimaryKeySet', function() {
    it('should return true if at least one column which does not belong to the primary key is set', function() {
      expect(objectTools.isAtLeastOneNotPrimaryKeyColumnSet(Object1, { property1: 'a' })).to.be.true
    })

    it('should return false if no column which does not belong to the primary key is set', function() {
      expect(objectTools.isAtLeastOneNotPrimaryKeyColumnSet(Object1, { })).to.be.false
    })
  })

  describe('objectsRepresentSameEntity', function() {
    it('should detect two rows as the same entity', function() {
      let row1 = { id: 1, column1: 'a', column2: 1 }
      let row2 = { id: 1, column1: 'b', column2: 2 }

      expect(objectTools.objectsRepresentSameEntity(Object1, row1, row2, true)).to.be.true
      expect(objectTools.objectsRepresentSameEntity(Object1, row2, row1, true)).to.be.true

      let row3 = { table1_id: 1, table2_id: 'x', column1: 'a' }
      let row4 = { table1_id: 1, table2_id: 'x', column1: 'b' }

      expect(objectTools.objectsRepresentSameEntity(ManyToManyObject2, row3, row4, true)).to.be.true
      expect(objectTools.objectsRepresentSameEntity(ManyToManyObject2, row3, row4, true)).to.be.true
    })

    it('should not detect two rows as the same entity', function() {
      let row1 = { id: 1 }
      let row2 = { id: 2, column1: 'a', column2: 1 }

      expect(objectTools.objectsRepresentSameEntity(Object1, row1, row2, true)).to.be.false
      expect(objectTools.objectsRepresentSameEntity(Object1, row2, row1, true)).to.be.false

      let row3 = { table1_id: 1, table2_id: 'x' }
      let row4 = { table1_id: 2, table2_id: 'x', column1: 'a' }

      expect(objectTools.objectsRepresentSameEntity(ManyToManyObject2, row3, row4, true)).to.be.false
      expect(objectTools.objectsRepresentSameEntity(ManyToManyObject2, row3, row4, true)).to.be.false
    })
  })  
})
