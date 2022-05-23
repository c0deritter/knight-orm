import { expect } from 'chai'
import 'mocha'
import { ManyToManyObject2, Object1, Object2, schema } from './testSchema'

describe('Schema', function() {
  describe('primaryKey', function() {
    it('should return all primary key columns', function() {
      expect(schema.getTable('table1').primaryKey).to.deep.equal([schema.getTable('table1').getColumn('id')])
      expect(schema.getTable('many_to_many_table2').primaryKey).to.deep.equal([
        schema.getTable('many_to_many_table2').getColumn('table1_id'),
        schema.getTable('many_to_many_table2').getColumn('table2_id')
      ])
    })
  })

  describe('notPrimaryKey', function() {
    it('should return all not primary key columns', function() {
      expect(schema.getTable('table2').notPrimaryKey).to.deep.equal([
        schema.getTable('table2').getColumn('column1'),
        schema.getTable('table2').getColumn('column2'),
        schema.getTable('table2').getColumn('column3'),
        schema.getTable('table2').getColumn('one_to_one_object1_id'),
        schema.getTable('table2').getColumn('one_to_many_object2_many_to_one_id')
      ])
      expect(schema.getTable('many_to_many_table2').notPrimaryKey).to.deep.equal([
        schema.getTable('many_to_many_table2').getColumn('column1'),
        schema.getTable('many_to_many_table2').getColumn('column2'),
        schema.getTable('many_to_many_table2').getColumn('column3')
      ])
    })
  })

  describe('instanceToRow', function() {
    it('should convert an instance to a row', function() {
      let object1 = new Object1
      object1.id = 1
      object1.property1 = 'a'
      object1.property2 = 1
      object1.manyToOneObject1Id = 2
      object1.oneToOneObject1Id = 3

      expect(schema.getTable('table1').instanceToRow(object1)).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: 2,
        many_to_one_object1_id: 2,
        one_to_one_object1_id: 3
      })
    })

    it('should convert an instance which has relationships to a row', function() {
      let object1 = new Object1
      object1.id = 1
      object1.property1 = 'a'
      object1.property2 = 1
      object1.manyToManyObject2 = [new ManyToManyObject2, new ManyToManyObject2]
      object1.manyToManyObject2[0].object1Id = 1
      object1.manyToManyObject2[0].object2Id = 'x'
      object1.manyToManyObject2[0].property1 = 'b'
      object1.manyToManyObject2[0].property2 = 2
      object1.manyToManyObject2[0].object1 = object1
      object1.manyToManyObject2[0].object2 = new Object2
      object1.manyToManyObject2[0].object2.id = 'x'
      object1.manyToManyObject2[0].object2.property1 = 'c'
      object1.manyToManyObject2[0].object2.property2 = 3
      object1.manyToManyObject2[1].object1Id = 1
      object1.manyToManyObject2[1].object2Id = 'y'
      object1.manyToManyObject2[1].property1 = 'd'
      object1.manyToManyObject2[1].property2 = 4
      object1.manyToManyObject2[1].object1 = object1
      object1.manyToManyObject2[1].object2 = new Object2
      object1.manyToManyObject2[1].object2.id = 'y'
      object1.manyToManyObject2[1].object2.property1 = 'e'
      object1.manyToManyObject2[1].object2.property2 = 5

      let row = schema.getTable('table1').instanceToRow(object1)

      let expectedRow = {
        id: 1,
        column1: 'b',
        column2: 2,
        manyToManyObject2: [
          {
            table1_id: 1,
            table2_id: 'x',
            column1: 'c',
            column2: 3,
            object2: {
              id: 'x',
              column1: 'd',
              column2: 4
            }
          } as any,
          {
            table1_id: 1,
            table2_id: 'y',
            column1: 'e',
            column2: 5,
            object2: {
              id: 'y',
              column1: 'f',
              column2: 6
            }
          } as any
        ]
      }

      expectedRow.manyToManyObject2[0].object1 = expectedRow
      expectedRow.manyToManyObject2[1].object1 = expectedRow

      expect(row).to.deep.equal(expectedRow)
    })

    it('should use a custom instanceToRow function', function() {
      let object1 = new Object1
      object1.id = 1
      object1.property1 = 'a'
      object1.property2 = 2
      object1.manyToOneObject1Id = 2
      object1.oneToOneObject1Id = 3

      let originalInstanceToRow = schema.getTable('table1').customInstanceToRow
      schema.getTable('table1').customInstanceToRow = function(instance: Object1, row: any) {
        row.column1 = 'q'
        row.column2 = 10
      }
      
      let row = schema.getTable('table1').instanceToRow(object1)
      schema.getTable('table1').customInstanceToRow = originalInstanceToRow

      expect(row).to.deep.equal({
        id: 1,
        column1: 'q',
        column2: 10 ,
        many_to_one_object1_id: 2,
        one_to_one_object1_id: 3
      })
    })
  })

  describe('rowToInstance', function() {
    it('should convert a row to an instance', function() {
      let row = {
        id: 1,
        column1: 'b',
        column2: 2,
        many_to_one_object1_id: 2,
        one_to_one_object1_id: 3
      }

      expect(schema.getTable('table1').rowToInstance(row)).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        manyToOneObject1Id: 2,
        oneToOneObject1Id: 3
      })
    })

    it('should convert a row which has relationships to an instance', function() {
      let row = {
        id: 1,
        column1: 'b',
        column2: 2,
        manyToManyObject2: [
          {
            table1_id: 1,
            table2_id: 'x',
            column1: 'c',
            object2: {
              id: 'x',
              column1: 'd'
            }
          } as any,
          {
            table1_id: 1,
            table2_id: 'y',
            column1: 'e',
            object2: {
              id: 'y',
              column1: 'f'
            }
          } as any
        ]
      }

      row.manyToManyObject2[0].object1 = row
      row.manyToManyObject2[1].object1 = row

      let instance = schema.getTable('table1').rowToInstance(row)

      let expectedInstance = {
        id: 1,
        property1: 'a',
        property2: 1,
        manyToManyObject2: [
          {
            object1Id: 1,
            object2Id: 'x',
            property1: 'b',
            object2: {
              id: 'x',
              property1: 'c'
            }
          } as ManyToManyObject2,
          {
            object1Id: 1,
            object2Id: 'y',
            property1: 'd',
            object2: {
              id: 'y',
              property1: 'e'
            }
          } as ManyToManyObject2
        ]
      }

      expectedInstance.manyToManyObject2[0].object1 = expectedInstance
      expectedInstance.manyToManyObject2[1].object1 = expectedInstance

      expect(instance).to.deep.equal(expectedInstance)
    })

    it('should use a custom rowToInstance function', function() {
      let row = {
        id: 1,
        column1: 'b',
        column2: 2,
        many_to_one_object1_id: 2,
        one_to_one_object1_id: 3
      }

      let originalRowToInstance = schema.getTable('table1').customRowToInstance
      schema.getTable('table1').customRowToInstance = function(row: any, instance: Object1) {
        instance.property1 = 'q'
        instance.property2 = 10
      }
      
      let instance = schema.getTable('table1').rowToInstance(row)
      schema.getTable('table1').customRowToInstance = originalRowToInstance

      expect(instance).to.deep.equal({
        id: 1,
        property1: 'q',
        property2: 10,
        manyToOneObject1Id: 2,
        oneToOneObject1Id: 3
      })
    })
  })
})
