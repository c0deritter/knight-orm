import { expect } from 'chai'
import { CriteriaObject } from 'knight-criteria'
import 'mocha'
import { instanceCriteriaToRowCriteria, instanceToDeleteCriteria, instanceToUpdateCriteria, validateCriteria } from '../src/criteriaTools'
import { ManyObject, Object1, Object2, schema } from './testSchema'

describe('criteriaTools', function() {
  describe('validateCriteria', function() {
    it('should not find issues if the given criteria empty', function() {
      expect(validateCriteria(schema, 'table1', {})).to.deep.equal([])
    })

    it('should not find issues if the given criteria are valid', function() {
      expect(validateCriteria(schema, 'table1', {
        id: 1,
        column1: 'a',
        object1: {
          column2: 1,
          '@orderBy': 'id',
          '@limit': 5,
          '@offset': 10
        },
        '@orderBy': 'id',
        '@limit': 5,
        '@offset': 10
      })).to.deep.equal([])
    })

    it('should not find issues if the given comparison is valid', function() {
      expect(validateCriteria(schema, 'table1', {
        column1: {
          '@operator': '=',
          '@value': 'a'
        },
        column2: {
          '@operator': '>'
        }
      })).to.deep.equal([])
    })

    it('should not find issues if the given criteria which are given as an array are valid', function() {
      expect(validateCriteria(schema, 'table1', [{
        id: 1,
        column1: 'a',
        object1: {
          column2: 1,
          '@orderBy': 'id',
          '@limit': 5,
          '@offset': 10  
        },
        '@orderBy': 'id',
        '@limit': 5,
        '@offset': 10
      }])).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @load', function() {
      expect(validateCriteria(schema, 'table1', {
        object1: {
          '@load': true
        }
      })).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @loadSeparately', function() {
      expect(validateCriteria(schema, 'table1', {
        object1: {
          '@loadSeparately': true
        }
      })).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @not', function() {
      expect(validateCriteria(schema, 'table1', {
        object1: {
          '@not': true
        }
      })).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @count', function() {
      expect(validateCriteria(schema, 'table1', {
        object1: {
          '@count': true
        }
      })).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @max', function() {
      expect(validateCriteria(schema, 'table1', {
        object1: {
          '@max': true
        }
      })).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @min', function() {
      expect(validateCriteria(schema, 'table1', {
        object1: {
          '@min': true
        }
      })).to.deep.equal([])
    })

    it('should find an issue if a column, relationship or @property does not exist', function() {
      expect(validateCriteria(schema, 'table1', {
        column: 'a',
        object: {},
        '@invalid': true
      })).to.deep.equal([
        {
          location: 'column',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'object',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: '@invalid',
          message: 'Given column, relationship or @-property does not exist'
        }
      ])
    })

    it('should find an issue if a column, relationship or @property does not exist in a relationship', function() {
      expect(validateCriteria(schema, 'table1', {
        object1: {
          column: 'a',
          object: {},
          '@invalid': true
        }
      })).to.deep.equal([
        {
          location: 'object1.column',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'object1.object',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'object1.@invalid',
          message: 'Given column, relationship or @-property does not exist'
        }
      ])
    })

    it('should find an issue if a column, relationship or @property does not exist in a relationship with criteria given as an array', function() {
      expect(validateCriteria(schema, 'table1', [{
        object1: {
          column: 'a',
          object: {},
          '@invalid': true
        }
      }])).to.deep.equal([
        {
          location: 'object1.column',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'object1.object',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'object1.@invalid',
          message: 'Given column, relationship or @-property does not exist'
        }
      ])
    })
  })

  describe('instanceCriteriaToRowCriteria', function() {
    it('should convert simple instance criteria', function() {
      let instanceCriteria = {
        property1: 'a',
        property2: { operator: '>', value: 1 }
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema, 'table1', instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        column1: 'a',
        column2: { operator: '>', value: 1 }
      })
    })

    it('should convert instance criteria with a relationship', function() {
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

    it('should convert instance criteria given as array', function() {
      let instanceCriteria = [
        {
          property1: 'a',
          property2: { operator: '>', value: 1 }
        },
        'OR',
        {
          manyObjects: {
            property1: { operator: 'LIKE', value: '%b%' },
            object2: {
              property1: 'c'
            }
          }  
        }
      ]

      let rowCriteria = instanceCriteriaToRowCriteria(schema, 'table1', instanceCriteria)

      expect(rowCriteria).to.deep.equal([
        {
          column1: 'a',
          column2: { operator: '>', value: 1 }
        },
        'OR',
        {
          manyObjects: {
            column1: { operator: 'LIKE', value: '%b%' },
            object2: {
              column1: 'c'
            }
          }
        }
      ])
    })

    it('should preserve criteria specific properties that start with @', function() {
      let instanceCriteria: CriteriaObject = {
        '@not': true,
        '@load': true,
        '@loadSeparately': true,
        '@count': 1,
        '@min': 2,
        '@max': { '@operator': '<', '@value': 10 },
        '@limit': 10,
        '@offset': 20
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema, 'table1', instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        '@not': true,
        '@load': true,
        '@loadSeparately': true,
        '@count': 1,
        '@min': 2,
        '@max': { '@operator': '<', '@value': 10 },
        '@limit': 10,
        '@offset': 20
      })
    })

    it('should not preserve properties that start with @ but are invalid', function() {
      let instanceCriteria = {
        '@invalid': true
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema, 'table1', instanceCriteria)

      expect(rowCriteria).to.deep.equal({})
    })

    it('should convert an order by which refers single property', function() {
      let instanceCriteria = {
        '@orderBy': 'property1'
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema, 'table1', instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        '@orderBy': 'column1'
      })
    })

    it('should convert an order by which uses an order by object', function() {
      let instanceCriteria = {
        '@orderBy': {
          field: 'property1',
          direction: 'DESC'
        }
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema, 'table1', instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        '@orderBy': {
          field: 'column1',
          direction: 'DESC'
        }
      })
    })

    it('should convert an order by which uses an array of single properties and order by objects', function() {
      let instanceCriteria = {
        '@orderBy': [
          {
            field: 'property1',
            direction: 'DESC'
          },
          'property2'
        ]
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema, 'table1', instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        '@orderBy': [
          {
            field: 'column1',
            direction: 'DESC'
          },
          'column2'
        ]
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
