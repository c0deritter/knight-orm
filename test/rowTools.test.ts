import { expect } from 'chai'
import 'mocha'
import { instanceToRow, rowsRepresentSameEntity, rowToInstance, unjoinRows } from '../src/rowTools'
import { ManyObjects, Object1, Object2, schema } from './testSchema'

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
        column2: 1
      })
    })

    it('should convert an instance which has relationships to a row', function() {
      let object1 = new Object1
      object1.id = 1
      object1.property1 = 'a'
      object1.property2 = 1
      object1.many = [new ManyObjects, new ManyObjects]
      object1.many[0].object1Id = 1
      object1.many[0].object2Id = 'x'
      object1.many[0].property1 = 'b'
      object1.many[0].object1Id2 = null
      object1.many[0].object1 = object1
      object1.many[0].object2 = new Object2
      object1.many[0].object2.id = 'x'
      object1.many[0].object2.property1 = 'c'
      object1.many[1].object1Id = 1
      object1.many[1].object2Id = 'y'
      object1.many[1].property1 = 'd'
      object1.many[1].object1Id2 = null
      object1.many[1].object1 = object1
      object1.many[1].object2 = new Object2
      object1.many[1].object2.id = 'y'
      object1.many[1].object2.property1 = 'e'

      let row = instanceToRow(schema, 'table1', object1)
      console.log('row', row)

      let expectedRow = {
        id: 1,
        column1: 'a',
        column2: 1,
        many: [
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

      expectedRow.many[0].object1 = expectedRow
      expectedRow.many[1].object1 = expectedRow

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
        property2: 1
      })
    })

    it('should convert a row which has relationships to an instance', function() {
      let row = {
        id: 1,
        column1: 'a',
        column2: 1,
        many: [
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

      row.many[0].object1 = row
      row.many[1].object1 = row

      let instance = rowToInstance(schema, 'table1', row)

      let expectedInstance = {
        id: 1,
        property1: 'a',
        property2: 1,
        many: [
          {
            object1Id: 1,
            object2Id: 'x',
            property1: 'b',
            object1Id2: null,
            object2: {
              id: 'x',
              property1: 'c'
            }
          } as ManyObjects,
          {
            object1Id: 1,
            object2Id: 'y',
            property1: 'd',
            object1Id2: null,
            object2: {
              id: 'y',
              property1: 'e'
            }
          } as ManyObjects
        ]
      }

      expectedInstance.many[0].object1 = expectedInstance
      expectedInstance.many[1].object1 = expectedInstance

      expect(instance).to.deep.equal(expectedInstance)
    })
  })

  describe('unjoinRows', function() {
    it('should create corresponding instance from simple rows without relationships', function() {
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
      let instances = unjoinRows(schema, 'table1', rows, criteria, true)

      expect(instances.length).to.equal(2)
      expect(instances[0]).to.be.instanceOf(Object1)
      expect(instances[0]).to.deep.equal({ id: 1, property1: 'a', property2: 1 })
      expect(instances[1]).to.be.instanceOf(Object1)
      expect(instances[1]).to.deep.equal({ id: 2, property1: 'b', property2: 2 })
    })

    it('should create corresponding instance from simple rows with relationships', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__many__table1_id: 1,
          table1__many__table2_id: 1,
          table1__many__column1: 'b',
          table1__many__table1_id2: null,
          table1__many__object2__id: 1,
          table1__many__object2__column1: 'c'
        },
        {
          table1__id: 2,
          table1__column1: 'd',
          table1__column2: 2,
          table1__many__table1_id: 2,
          table1__many__table2_id: null,
          table1__many__column1: 'e',
          table1__many__table1_id2: null,
          table1__many__object2__id: null,
          table1__many__object2__column1: null
        },
        {
          table1__id: 3,
          table1__column1: 'f',
          table1__column2: 3,
          table1__many__table1_id: null,
          table1__many__table2_id: null,
          table1__many__column1: null,
          table1__many__table1_id2: null,
          table1__many__object2__id: null,
          table1__many__object2__column1: null
        }
      ]

      let criteria = { many: { object2: {} }}

      let instances = unjoinRows(schema, 'table1', rows, criteria, true)

      expect(instances.length).to.equal(3)
      expect(instances[0]).to.be.instanceOf(Object1)
      expect(instances[0].many).to.be.instanceOf(Array)
      expect(instances[0].many[0]).to.be.instanceOf(ManyObjects)
      expect(instances[0].many[0].object2).to.be.instanceOf(Object2)
      expect(instances[0]).to.deep.equal({ id: 1, property1: 'a', property2: 1, many: [{ object1Id: 1, object2Id: 1, property1: 'b', object2: { id: 1, property1: 'c' }}]})
      expect(instances[1]).to.be.instanceOf(Object1)
      expect(instances[1].many).to.be.instanceOf(Array)
      expect(instances[1].many[0]).to.be.instanceOf(ManyObjects)
      expect(instances[1].many[0].object2).to.be.undefined
      expect(instances[1]).to.deep.equal({ id: 2, property1: 'd', property2: 2, many: [{ object1Id: 2, object2Id: null, property1: 'e' }]})
      expect(instances[2]).to.be.instanceOf(Object1)
      expect(instances[2].many).to.be.undefined
      expect(instances[2]).to.deep.equal({ id: 3, property1: 'f', property2: 3 })
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
})
