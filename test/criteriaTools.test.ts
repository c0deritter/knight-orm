import { expect } from 'chai'
import 'mocha'
import { instanceCriteriaToRowCriteria, instanceToDeleteCriteria, instanceToUpdateCriteria } from '../src/criteriaTools'
import { ManyObjects, Object1, Object2, schema } from './testSchema'

describe('criteriaTools', function() {
  describe('instanceCriteriaToRowCriteria', function() {
    it('should convert instance criteria to row criteria', function() {
      let instanceCriteria = {
        property1: 'a',
        property2: { operator: '>', value: 1 },
        many: {
          property1: { operator: 'LIKE', value: '%b%' },
          object2: {
            property1: 'c'
          }
        }
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema, 'table1', instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        column1: 'a',
        column2: { operator: '>', value: 1 },
        many: {
          column1: { operator: 'LIKE', value: '%b%' },
          object2: {
            column1: 'c'
          }
        }
      })
    })
  })

  describe('instanceToUpdateCriteria', function() {
    it('should convert an instance to update criteria', function() {
      let table1 = new Object1
      table1.id = 1
      table1.property1 = 'a'
      table1.property2 = 1
      table1.many = [ new ManyObjects ]
      table1.many[0].property1 = 'b'
      
      let criteria = instanceToUpdateCriteria(schema, 'table1', table1)

      expect(criteria).to.deep.equal({
        id: 1,
        set: {
          column1: 'a',
          column2: 1
        }
      })
    })
  })

  describe('instanceToDeleteCriteria', function() {
    it('should convert an instance to delete criteria', function() {
      let tableMany = new ManyObjects
      tableMany.object1Id = 1
      tableMany.object2Id = '2'
      tableMany.property1 = 'a'
      tableMany.object1 = new Object1
      tableMany.object1.id = 1
      tableMany.object1.property1 = 'a'
      tableMany.object1.property2 = 1
      tableMany.object1.many = [ tableMany ]
      tableMany.object2 = new Object2
      
      let criteria = instanceToDeleteCriteria(schema, 'table_many', tableMany)

      expect(criteria).to.deep.equal({
        table1_id: 1,
        table2_id: '2'
      })
    })
  })
})
