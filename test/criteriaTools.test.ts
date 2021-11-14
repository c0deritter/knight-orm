import { expect } from 'chai'
import 'mocha'
import { instanceCriteriaToRowCriteria, instanceToDeleteCriteria, instanceToUpdateCriteria } from '../src/criteriaTools'
import { ManyObject, Object1, Object2, schema } from './testSchema'

describe('criteriaTools', function() {
  describe('instanceCriteriaToRowCriteria', function() {
    it('should convert instance criteria to row criteria', function() {
      let instanceCriteria = {
        property1: 'a',
        property2: { operator: '>', value: 1 },
        manyObjects: {
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
        manyObjects: {
          column1: { operator: 'LIKE', value: '%b%' },
          object2: {
            column1: 'c'
          }
        }
      })
    })

    it('should preserve criteria specific properties that start with @', function() {
      let instanceCriteria = {
        manyObjects: {
          '@load': true
        }
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema, 'table1', instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        manyObjects: {
          '@load': true
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
      table1.manyObjects = [ new ManyObject ]
      table1.manyObjects[0].property1 = 'b'
      
      let criteria = instanceToUpdateCriteria(schema, 'table1', table1)

      expect(criteria).to.deep.equal({
        column1: 'a',
        column2: 1,
        '@criteria': {
          id: 1
        }
      })
    })
  })

  describe('instanceToDeleteCriteria', function() {
    it('should convert an instance to delete criteria', function() {
      let tableMany = new ManyObject
      tableMany.object1Id = 1
      tableMany.object2Id = '2'
      tableMany.property1 = 'a'
      tableMany.object1 = new Object1
      tableMany.object1.id = 1
      tableMany.object1.property1 = 'a'
      tableMany.object1.property2 = 1
      tableMany.object1.manyObjects = [ tableMany ]
      tableMany.object2 = new Object2
      
      let criteria = instanceToDeleteCriteria(schema, 'table_many', tableMany)

      expect(criteria).to.deep.equal({
        table1_id: 1,
        table2_id: '2'
      })
    })
  })
})
