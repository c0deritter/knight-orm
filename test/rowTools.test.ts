import { expect } from 'chai'
import 'mocha'
import { determineRelationshipsToLoad, instanceToRow, rowsRepresentSameEntity, rowToInstance, unjoinRows } from '../src/rowTools'
import { ManyObject, Object1, Object2, schema } from './testSchema'

describe('rowTools', function() {
  describe('instanceToRow', function() {
    it('should convert an instance to a row', function() {
      let object1 = new Object1
      object1.id = 1
      object1.property1 = 'a'
      object1.property2 = 1

      expect(instanceToRow(schema, 'table1', object1)).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1 ,
        table1_id: undefined,
        table2_id: undefined
      })
    })

    it('should convert an instance which has relationships to a row', function() {
      let object1 = new Object1
      object1.id = 1
      object1.property1 = 'a'
      object1.property2 = 1
      object1.manyObjects = [new ManyObject, new ManyObject]
      object1.manyObjects[0].object1Id = 1
      object1.manyObjects[0].object2Id = 'x'
      object1.manyObjects[0].property1 = 'b'
      object1.manyObjects[0].object1Id2 = null
      object1.manyObjects[0].object1 = object1
      object1.manyObjects[0].object2 = new Object2
      object1.manyObjects[0].object2.id = 'x'
      object1.manyObjects[0].object2.property1 = 'c'
      object1.manyObjects[0].object2.object1Id = null
      object1.manyObjects[1].object1Id = 1
      object1.manyObjects[1].object2Id = 'y'
      object1.manyObjects[1].property1 = 'd'
      object1.manyObjects[1].object1Id2 = null
      object1.manyObjects[1].object1 = object1
      object1.manyObjects[1].object2 = new Object2
      object1.manyObjects[1].object2.id = 'y'
      object1.manyObjects[1].object2.property1 = 'e'
      object1.manyObjects[1].object2.object1Id = null

      let row = instanceToRow(schema, 'table1', object1)

      let expectedRow = {
        id: 1,
        column1: 'a',
        column2: 1,
        table1_id: undefined,
        table2_id: undefined,
        manyObjects: [
          {
            table1_id: 1,
            table2_id: 'x',
            column1: 'b',
            table1_id2: null,
            object2: {
              id: 'x',
              column1: 'c',
              table1_id: null
            }
          } as any,
          {
            table1_id: 1,
            table2_id: 'y',
            column1: 'd',
            table1_id2: null,
            object2: {
              id: 'y',
              column1: 'e',
              table1_id: null
            }
          } as any
        ]
      }

      expectedRow.manyObjects[0].object1 = expectedRow
      expectedRow.manyObjects[1].object1 = expectedRow

      expect(row).to.deep.equal(expectedRow)
    })
  })

  describe('rowToInstance', function() {
    it('should convert a row to an instance', function() {
      let row = {
        id: 1,
        column1: 'a',
        column2: 1
      }

      expect(rowToInstance(schema, 'table1', row)).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        object1Id: undefined,
        object2Id: undefined
      })
    })

    it('should convert a row which has relationships to an instance', function() {
      let row = {
        id: 1,
        column1: 'a',
        column2: 1,
        manyObjects: [
          {
            table1_id: 1,
            table2_id: 'x',
            column1: 'b',
            table1_id2: null,
            object2: {
              id: 'x',
              column1: 'c'
            }
          } as any,
          {
            table1_id: 1,
            table2_id: 'y',
            column1: 'd',
            table1_id2: null,
            object2: {
              id: 'y',
              column1: 'e'
            }
          } as any
        ]
      }

      row.manyObjects[0].object1 = row
      row.manyObjects[1].object1 = row

      let instance = rowToInstance(schema, 'table1', row)

      let expectedInstance = {
        id: 1,
        property1: 'a',
        property2: 1,
        object1Id: undefined,
        object2Id: undefined,
        manyObjects: [
          {
            object1Id: 1,
            object2Id: 'x',
            property1: 'b',
            object1Id2: null,
            object2: {
              id: 'x',
              property1: 'c',
              object1Id: undefined
            }
          } as ManyObject,
          {
            object1Id: 1,
            object2Id: 'y',
            property1: 'd',
            object1Id2: null,
            object2: {
              id: 'y',
              property1: 'e',
              object1Id: undefined
            }
          } as ManyObject
        ]
      }

      expectedInstance.manyObjects[0].object1 = expectedInstance
      expectedInstance.manyObjects[1].object1 = expectedInstance

      expect(instance).to.deep.equal(expectedInstance)
    })
  })

  describe('unjoinRows', function() {
    it('should create an instance out of rows without relationships', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__somethingElse: '?'
        },
        {
          table1__id: 2,
          table1__column1: 'b',
          table1__column2: 2,
          table1__somethingElse: '?'
        }
      ]

      let criteria = { a: 'a', b: 1 }
      let instances = unjoinRows(schema, 'table1', rows, criteria, 'table1__')

      expect(instances.length).to.equal(2)
      expect(instances[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1
      })
      expect(instances[1]).to.deep.equal({
        id: 2,
        column1: 'b',
        column2: 2
      })
    })

    it('should create an instance out of rows with relationships', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__table1_id: null,
          table1__table2_id: null,
          table1__manyObjects__table1_id: 1,
          table1__manyObjects__table2_id: 1,
          table1__manyObjects__column1: 'b',
          table1__manyObjects__table1_id2: null,
          table1__manyObjects__object2__id: 1,
          table1__manyObjects__object2__column1: 'c',
          table1__manyObjects__object2__table1_id: null
        },
        {
          table1__id: 2,
          table1__column1: 'd',
          table1__column2: 2,
          table1__table1_id: null,
          table1__table2_id: null,
          table1__manyObjects__table1_id: 2,
          table1__manyObjects__table2_id: null,
          table1__manyObjects__column1: 'e',
          table1__manyObjects__table1_id2: null,
          table1__manyObjects__object2__id: null,
          table1__manyObjects__object2__column1: null,
          table1__manyObjects__object2__table1_id: null
        },
        {
          table1__id: 3,
          table1__column1: 'f',
          table1__column2: 3,
          table1__table1_id: null,
          table1__table2_id: null,
          table1__manyObjects__table1_id: null,
          table1__manyObjects__table2_id: null,
          table1__manyObjects__column1: null,
          table1__manyObjects__table1_id2: null,
          table1__manyObjects__object2__id: null,
          table1__manyObjects__object2__column1: null,
          table1__manyObjects__object2__table1_id: null
        }
      ]

      let criteria = { manyObjects: { object2: {} }}

      let instances = unjoinRows(schema, 'table1', rows, criteria, 'table1__')

      expect(instances.length).to.equal(3)
      expect(instances[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1,
        table1_id: null,
        table2_id: null,
        manyObjects: [{
          table1_id: 1,
          table2_id: 1,
          column1: 'b',
          table1_id2: null,
          object2: {
            id: 1,
            column1: 'c',
            table1_id: null
          }
        }]
      })

      expect(instances[1]).to.deep.equal({
        id: 2,
        column1: 'd',
        column2: 2,
        table1_id: null,
        table2_id: null,
        manyObjects: [{
          table1_id: 2,
          table2_id: null,
          column1: 'e',
          table1_id2: null,
          object2: null
        }]
      })

      expect(instances[2]).to.deep.equal({
        id: 3,
        column1: 'f',
        column2: 3,
        table1_id: null,
        table2_id: null,
        manyObjects: []
      })
    })

    it('should not add a relationship row more than once', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__table1_id: null,
          table1__table2_id: null,
          table1__manyObjects__table1_id: 1,
          table1__manyObjects__table2_id: 'x',
          table1__manyObjects__column1: 'b',
          table1__manyObjects__table1_id2: null,
          table1__manyObjects__object2__id: 'x',
          table1__manyObjects__object2__column1: 'c',
          table1__manyObjects__object2__table1_id: null,
          table1__manyObjects__object2__manyObjects__table1_id: 2,
          table1__manyObjects__object2__manyObjects__table2_id: 'x',
          table1__manyObjects__object2__manyObjects__column1: 'd',
          table1__manyObjects__object2__manyObjects__table1_id2: null,
        },
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__table1_id: null,
          table1__table2_id: null,
          table1__manyObjects__table1_id: 1,
          table1__manyObjects__table2_id: 'x',
          table1__manyObjects__column1: 'b',
          table1__manyObjects__table1_id2: null,
          table1__manyObjects__object2__id: 'x',
          table1__manyObjects__object2__column1: 'c',
          table1__manyObjects__object2__table1_id: null,
          table1__manyObjects__object2__manyObjects__table1_id: 3,
          table1__manyObjects__object2__manyObjects__table2_id: 'x',
          table1__manyObjects__object2__manyObjects__column1: 'e',
          table1__manyObjects__object2__manyObjects__table1_id2: null,
        }
      ]

      let criteria = { manyObjects: { object2: { manyObjects: {} }}}

      let instances = unjoinRows(schema, 'table1', rows, criteria, 'table1__')

      expect(instances.length).to.equal(1)
      expect(instances[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1,
        table1_id: null,
        table2_id: null,
        manyObjects: [{
          table1_id: 1,
          table2_id: 'x',
          column1: 'b',
          table1_id2: null,
          object2: {
            id: 'x',
            column1: 'c',
            table1_id: null,
            manyObjects: [
              {
                table1_id: 2,
                table2_id: 'x',
                column1: 'd',
                table1_id2: null
              },
              {
                table1_id: 3,
                table2_id: 'x',
                column1: 'e',
                table1_id2: null
              }
            ]
          }
        }]
      })
    })

    it('should not fill an empty one-to-many relationship with undefined', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__table1_id: null,
          table1__table2_id: 'x',
          table1__object2__id: 'x',
          table1__object2__column1: 'c',
          table1__object2__table1_id: null,
          table1__manyObjects__table1_id: null,
          table1__manyObjects__table2_id: null,
          table1__manyObjects__column1: null,
          table1__manyObjects__table1_id2: null,
        },
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__table1_id: null,
          table1__table2_id: 'x',
          table1__object2__id: 'x',
          table1__object2__column1: 'c',
          table1__object2__table1_id: null,
          table1__manyObjects__table1_id: null,
          table1__manyObjects__table2_id: null,
          table1__manyObjects__column1: null,
          table1__manyObjects__table1_id2: null,
        }
      ]

      let criteria = { object2: {}, manyObjects: { object2: {} }}

      let instances = unjoinRows(schema, 'table1', rows, criteria, 'table1__')

      expect(instances.length).to.equal(1)

      let expectedInstance = {
        id: 1,
        column1: 'a',
        column2: 1,
        table1_id: null,
        table2_id: 'x',
        object2: {
          id: 'x',
          column1: 'c',
          table1_id: null
        },
        manyObjects: []
      } as any

      expect(instances[0]).to.deep.equal(expectedInstance)
    })
  })

  describe('rowsRepresentSameEntity', function() {
    it('should detect two rows as the same entity', function() {
      let row1 = { id: 1, column1: 'a', column2: 1 }
      let row2 = { id: 1, column1: 'b', column2: 2 }

      expect(rowsRepresentSameEntity(schema['table1'], row1, row2)).to.be.true
      expect(rowsRepresentSameEntity(schema['table1'], row2, row1)).to.be.true

      let row3 = { table1_id: 1, table2_id: 'x', column1: 'a' }
      let row4 = { table1_id: 1, table2_id: 'x', column1: 'b' }

      expect(rowsRepresentSameEntity(schema['table_many'], row3, row4)).to.be.true
      expect(rowsRepresentSameEntity(schema['table_many'], row3, row4)).to.be.true
    })

    it('should not detect two rows as the same entity', function() {
      let row1 = { id: 1 }
      let row2 = { id: 2, column1: 'a', column2: 1 }

      expect(rowsRepresentSameEntity(schema['table1'], row1, row2)).to.be.false
      expect(rowsRepresentSameEntity(schema['table1'], row2, row1)).to.be.false

      let row3 = { table1_id: 1, table2_id: 'x' }
      let row4 = { table1_id: 2, table2_id: 'x', column1: 'a' }

      expect(rowsRepresentSameEntity(schema['table_many'], row3, row4)).to.be.false
      expect(rowsRepresentSameEntity(schema['table_many'], row3, row4)).to.be.false
    })
  })

  describe('determineRelationshipsToLoad', function() {
    it('should not load a relationship which does not have any criteria', function() {
      let criteria = {}
      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(0)
    })

    it('should load a relationship which should be loaded separately', function() {
      let criteria = { manyObjects: { '@loadSeparately': true }}
      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyObjects']).to.deep.equal({
        tableName: 'table1',
        relationshipName: 'manyObjects',
        relationshipCriteria: { '@loadSeparately': true },
        rows: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })

    it('should not load a relationship which should be not loaded separately', function() {
      let criteria = { manyObjects: { '@loadSeparately': false }}
      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(0)
    })

    it('should determine the relationships to load of an already JOIN loaded relationship', function() {
      let criteria = { manyObjects: { '@load': true, object1: { '@load': true }, object2: { '@loadSeparately': true }}}
      let rows = [
        { column1: 'a', column2: 1, manyObjects: [ { column1: 'a1' }, { column1: 'a2' } ] },
        { column1: 'b', column2: 2, manyObjects: [ { column1: 'b1' } ] },
        { column1: 'c', column2: 3, manyObjects: [] },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyObjects.object2']).to.deep.equal({
        tableName: 'table_many',
        relationshipName: 'object2',
        relationshipCriteria: { '@loadSeparately': true },
        rows: [
          { column1: 'a1' },
          { column1: 'a2' },
          { column1: 'b1' },
        ]
      })
    })

    it('should not determine the relationships to load of relationship that is not to load', function() {
      let criteria = { manyObjects: { object1: { '@load': true }, object2: { '@loadSeparately': true }}}
      let rows = [
        { column1: 'a', column2: 1, manyObjects: [ { column1: 'a1' }, { column1: 'a2' } ] },
        { column1: 'b', column2: 2, manyObjects: [ { column1: 'b1' } ] },
        { column1: 'c', column2: 3, manyObjects: [] },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(0)
    })

    it('should determine the relationships to load if inside an array', function() {
      let criteria = [
        { manyObjects: { '@loadSeparately': true }},
        'XOR',
        {}
      ]

      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyObjects']).to.deep.equal({
        tableName: 'table1',
        relationshipName: 'manyObjects',
        relationshipCriteria: { '@loadSeparately': true },
        rows: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })

    it('should determine the relationships to load if inside an array of an array', function() {
      let criteria = [
        [ { manyObjects: { '@loadSeparately': true }} ],
        'XOR',
        {}
      ]

      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyObjects']).to.deep.equal({
        tableName: 'table1',
        relationshipName: 'manyObjects',
        relationshipCriteria: { '@loadSeparately': true },
        rows: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })

    it('should use the criteria of first occuring relationship if there is not just one criteria for that relationship', function() {
      let criteria = [
        { manyObjects: { '@loadSeparately': true, column1: 'a' }},
        'XOR',
        { manyObjects: { '@loadSeparately': true, column1: 'b' }}
      ]

      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyObjects']).to.deep.equal({
        tableName: 'table1',
        relationshipName: 'manyObjects',
        relationshipCriteria: { '@loadSeparately': true, column1: 'a' },
        rows: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })
  })
})
