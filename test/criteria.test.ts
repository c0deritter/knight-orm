import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import { CriteriaObject } from 'knight-criteria'
import 'mocha'
import { Orm } from '../src'
import { CriteriaTools } from '../src/criteria'
import { schema } from './testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

let criteriaTools = new CriteriaTools(new Orm(schema, 'postgres'))

describe('criteria', function() {
  describe('validateCriteria', function() {
    it('should not find issues if the given criteria empty', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {}, true)).to.deep.equal([])
    })

    it('should not find issues if the given criteria are valid', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {
        id: 1,
        column1: 'a',
        manyToOneObject2: {
          column2: 1,
          '@orderBy': 'id',
          '@limit': 5,
          '@offset': 10
        },
        '@orderBy': 'id',
        '@limit': 5,
        '@offset': 10
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given comparison is valid', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {
        column1: {
          '@operator': '=',
          '@value': 'a'
        },
        column2: {
          '@operator': '>'
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given criteria which are given as an array are valid', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), [{
        id: 1,
        column1: 'a',
        manyToOneObject2: {
          column2: 1,
          '@orderBy': 'id',
          '@limit': 5,
          '@offset': 10  
        },
        '@orderBy': 'id',
        '@limit': 5,
        '@offset': 10
      }], true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @load', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@load': true
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @loadSeparately', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@loadSeparately': true
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @not', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@not': true
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @count', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@count': true
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @max', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@max': true
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @min', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@min': true
        }
      }, true)).to.deep.equal([])
    })

    it('should find an issue if a column, relationship or @property does not exist', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {
        column: 'a',
        object: {},
        '@invalid': true
      }, true)).to.deep.equal([
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
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          column: 'a',
          object: {},
          '@invalid': true
        }
      }, true)).to.deep.equal([
        {
          location: 'manyToOneObject2.column',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'manyToOneObject2.object',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'manyToOneObject2.@invalid',
          message: 'Given column, relationship or @-property does not exist'
        }
      ])
    })

    it('should find an issue if a column, relationship or @property does not exist in a relationship with criteria given as an array', function() {
      expect(criteriaTools.validateCriteria(schema.getTable('table1'), [{
        manyToOneObject2: {
          column: 'a',
          object: {},
          '@invalid': true
        }
      }], true)).to.deep.equal([
        {
          location: 'manyToOneObject2.column',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'manyToOneObject2.object',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'manyToOneObject2.@invalid',
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

      let rowCriteria = criteriaTools.instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        column1: 'a',
        column2: { operator: '>', value: 1 }
      })
    })

    it('should convert instance criteria with a relationship', function() {
      let instanceCriteria = {
        property1: 'a',
        property2: { operator: '>', value: 1 },
        manyToManyObject2: {
          property1: { operator: 'LIKE', value: '%b%' },
          object2: {
            property1: 'c'
          }
        }
      }

      let rowCriteria = criteriaTools.instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        column1: 'a',
        column2: { operator: '>', value: 1 },
        manyToManyObject2: {
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
          manyToManyObject2: {
            property1: { operator: 'LIKE', value: '%b%' },
            object2: {
              property1: 'c'
            }
          }  
        }
      ]

      let rowCriteria = criteriaTools.instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal([
        {
          column1: 'a',
          column2: { operator: '>', value: 1 }
        },
        'OR',
        {
          manyToManyObject2: {
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

      let rowCriteria = criteriaTools.instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

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

      let rowCriteria = criteriaTools.instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal({})
    })

    it('should convert an order by which refers single property', function() {
      let instanceCriteria = {
        '@orderBy': 'property1'
      }

      let rowCriteria = criteriaTools.instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

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

      let rowCriteria = criteriaTools.instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

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

      let rowCriteria = criteriaTools.instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

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

  describe('determineRelationshipsToLoadSeparately', function() {
    it('should not load a relationship which does not have any criteria', function() {
      let criteria = {}
      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = criteriaTools.determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(0)
    })

    it('should load a relationship which should be loaded separately', function() {
      let criteria = { manyToManyObject2: { '@loadSeparately': true }}
      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = criteriaTools.determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToManyObject2']).to.deep.equal({
        relationship: schema.getTable('table1').getRelationship('manyToManyObject2'),
        relationshipCriteria: { '@loadSeparately': true },
        objs: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })

    it('should not load a relationship which should be not loaded separately', function() {
      let criteria = { manyToManyObject2: { '@loadSeparately': false }}
      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = criteriaTools.determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(0)
    })

    it('should determine the relationships to load of an already JOIN loaded relationship', function() {
      let criteria = { manyToManyObject2: { '@load': true, object1: { '@load': true }, object2: { '@loadSeparately': true }}}
      let rows = [
        { column1: 'a', column2: 1, manyToManyObject2: [ { column1: 'a1' }, { column1: 'a2' } ] },
        { column1: 'b', column2: 2, manyToManyObject2: [ { column1: 'b1' } ] },
        { column1: 'c', column2: 3, manyToManyObject2: [] },
      ]

      let toLoad = criteriaTools.determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToManyObject2.object2']).to.deep.equal({
        relationship: schema.getTable('many_to_many_table2').getRelationship('object2'),
        relationshipCriteria: { '@loadSeparately': true },
        objs: [
          { column1: 'a1' },
          { column1: 'a2' },
          { column1: 'b1' },
        ]
      })
    })

    it('should not determine the relationships to load of relationship that is not to load', function() {
      let criteria = { manyToManyObject2: { object1: { '@load': true }, object2: { '@loadSeparately': true }}}
      let rows = [
        { column1: 'a', column2: 1, manyToManyObject2: [ { column1: 'a1' }, { column1: 'a2' } ] },
        { column1: 'b', column2: 2, manyToManyObject2: [ { column1: 'b1' } ] },
        { column1: 'c', column2: 3, manyToManyObject2: [] },
      ]

      let toLoad = criteriaTools.determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(0)
    })

    it('should determine the relationships to load if inside an array', function() {
      let criteria = [
        { manyToManyObject2: { '@loadSeparately': true }},
        'XOR',
        {}
      ]

      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = criteriaTools.determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToManyObject2']).to.deep.equal({
        relationship: schema.getTable('table1').getRelationship('manyToManyObject2'),
        relationshipCriteria: { '@loadSeparately': true },
        objs: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })

    it('should determine the relationships to load if inside an array of an array', function() {
      let criteria = [
        [ { manyToManyObject2: { '@loadSeparately': true }} ],
        'XOR',
        {}
      ]

      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = criteriaTools.determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToManyObject2']).to.deep.equal({
        relationship: schema.getTable('table1').getRelationship('manyToManyObject2'),
        relationshipCriteria: { '@loadSeparately': true },
        objs: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })

    it('should use the criteria of first occuring relationship if there is not just one criteria for that relationship', function() {
      let criteria = [
        { manyToManyObject2: { '@loadSeparately': true, column1: 'a' }},
        'XOR',
        { manyToManyObject2: { '@loadSeparately': true, column1: 'b' }}
      ]

      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = criteriaTools.determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToManyObject2']).to.deep.equal({
        relationship: schema.getTable('table1').getRelationship('manyToManyObject2'),
        relationshipCriteria: { '@loadSeparately': true, column1: 'a' },
        objs: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })
  })
})
