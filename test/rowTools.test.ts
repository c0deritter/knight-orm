import { expect } from 'chai'
import 'mocha'
import { determineRelationshipsToLoad, instanceToRow, rowsRepresentSameEntity, rowToInstance, unjoinRows } from '../src/rowTools'
import { ManyToMany, Object1, Object2, schema } from './testSchema'

describe('rowTools', function() {
  describe('instanceToRow', function() {
    it('should convert an instance to a row', function() {
      let object1 = new Object1
      object1.id = 1
      object1.property1 = 'a'
      object1.property2 = 1
      object1.manyToOneId = 2
      object1.oneToOneId = 3

      expect(instanceToRow(schema, 'table1', object1)).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1,
        many_to_one_id: 2,
        one_to_one_id: 3
      })
    })

    it('should convert an instance which has relationships to a row', function() {
      let object1 = new Object1
      object1.id = 1
      object1.property1 = 'a'
      object1.property2 = 1
      object1.manyToMany = [new ManyToMany, new ManyToMany]
      object1.manyToMany[0].object1Id = 1
      object1.manyToMany[0].object2Id = 'x'
      object1.manyToMany[0].property1 = 'b'
      object1.manyToMany[0].property2 = 2
      object1.manyToMany[0].object1 = object1
      object1.manyToMany[0].object2 = new Object2
      object1.manyToMany[0].object2.id = 'x'
      object1.manyToMany[0].object2.property1 = 'c'
      object1.manyToMany[0].object2.property2 = 3
      object1.manyToMany[1].object1Id = 1
      object1.manyToMany[1].object2Id = 'y'
      object1.manyToMany[1].property1 = 'd'
      object1.manyToMany[1].property2 = 4
      object1.manyToMany[1].object1 = object1
      object1.manyToMany[1].object2 = new Object2
      object1.manyToMany[1].object2.id = 'y'
      object1.manyToMany[1].object2.property1 = 'e'
      object1.manyToMany[1].object2.property2 = 5

      let row = instanceToRow(schema, 'table1', object1)

      let expectedRow = {
        id: 1,
        column1: 'a',
        column2: 1,
        manyToMany: [
          {
            table1_id: 1,
            table2_id: 'x',
            column1: 'b',
            column2: 2,
            object2: {
              id: 'x',
              column1: 'c',
              column2: 3
            }
          } as any,
          {
            table1_id: 1,
            table2_id: 'y',
            column1: 'd',
            column2: 4,
            object2: {
              id: 'y',
              column1: 'e',
              column2: 5
            }
          } as any
        ]
      }

      expectedRow.manyToMany[0].object1 = expectedRow
      expectedRow.manyToMany[1].object1 = expectedRow

      expect(row).to.deep.equal(expectedRow)
    })

    it('should use a custom rowToInstance function', function() {
      let object1 = new Object1
      object1.id = 1
      object1.property1 = 'a'
      object1.property2 = 2
      object1.manyToOneId = 2
      object1.oneToOneId = 3

      schema.table1.instanceToRow = function(instance: Object1, row: any) {
        row.id++
        row.column1 = 'b'
        return row
      }
      
      let row = instanceToRow(schema, 'table1', object1)
      delete schema.table1.instanceToRow

      expect(row).to.deep.equal({
        id: 2,
        column1: 'b',
        column2: 2 ,
        many_to_one_id: 2,
        one_to_one_id: 3
      })
    })
  })

  describe('rowToInstance', function() {
    it('should convert a row to an instance', function() {
      let row = {
        id: 1,
        column1: 'a',
        column2: 1,
        many_to_one_id: 2,
        one_to_one_id: 3
      }

      expect(rowToInstance(schema, 'table1', row)).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        manyToOneId: 2,
        oneToOneId: 3
      })
    })

    it('should convert a row which has relationships to an instance', function() {
      let row = {
        id: 1,
        column1: 'a',
        column2: 1,
        manyToMany: [
          {
            table1_id: 1,
            table2_id: 'x',
            column1: 'b',
            object2: {
              id: 'x',
              column1: 'c'
            }
          } as any,
          {
            table1_id: 1,
            table2_id: 'y',
            column1: 'd',
            object2: {
              id: 'y',
              column1: 'e'
            }
          } as any
        ]
      }

      row.manyToMany[0].object1 = row
      row.manyToMany[1].object1 = row

      let instance = rowToInstance(schema, 'table1', row)

      let expectedInstance = {
        id: 1,
        property1: 'a',
        property2: 1,
        manyToMany: [
          {
            object1Id: 1,
            object2Id: 'x',
            property1: 'b',
            object2: {
              id: 'x',
              property1: 'c'
            }
          } as ManyToMany,
          {
            object1Id: 1,
            object2Id: 'y',
            property1: 'd',
            object2: {
              id: 'y',
              property1: 'e'
            }
          } as ManyToMany
        ]
      }

      expectedInstance.manyToMany[0].object1 = expectedInstance
      expectedInstance.manyToMany[1].object1 = expectedInstance

      expect(instance).to.deep.equal(expectedInstance)
    })

    it('should use a custom rowToInstance function', function() {
      let row = {
        id: 1,
        column1: 'a',
        column2: 1,
        many_to_one_id: 2,
        one_to_one_id: 3
      }

      schema.table1.rowToInstance = function(instance: Object1, row: any) {
        instance.id!++
        instance.property1 = 'b'
        return row
      }
      
      let instance = rowToInstance(schema, 'table1', row)
      delete schema.table1.rowToInstance

      expect(instance).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        manyToOneId: 2,
        oneToOneId: 3
      })
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

    it('should not regard rows if every of column is NULL', function() {
      let rows = [
        {
          table1__id: null,
          table1__column1: null,
          table1__column2: null
        },
        {
          table1__id: null,
          table1__column1: null,
          table1__column2: null
        }
      ]

      let criteria = { }
      let instances = unjoinRows(schema, 'table1', rows, criteria, 'table1__')

      expect(instances.length).to.equal(0)
    })

    it('should unjoin many-to-one relationships', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__column3: null,
          table1__many_to_one_id: 'x',
          table1__many_to_one_recursive_id: 2,
          table1__one_to_one_id: null,
          table1__one_to_one_recursive_id: null,
          table1__one_to_many_recursive_id: null,
          table1__manyToOne__id: 'x',
          table1__manyToOne__column1: 'b',
          table1__manyToOne__column2: 2,
          table1__manyToOne__column3: null,
          table1__manyToOne__one_to_one_id: null,
          table1__manyToOne__one_to_many_id: null,
          table1__manyToOneRecursive__id: 2,
          table1__manyToOneRecursive__column1: 'c',
          table1__manyToOneRecursive__column2: 3,
          table1__manyToOneRecursive__column3: null,
          table1__manyToOneRecursive__many_to_one_id: null,
          table1__manyToOneRecursive__many_to_one_recursive_id: null,
          table1__manyToOneRecursive__one_to_one_id: null,
          table1__manyToOneRecursive__one_to_one_recursive_id: null,
          table1__manyToOneRecursive__one_to_many_recursive_id: null,
        },
        {
          table1__id: 3,
          table1__column1: 'd',
          table1__column2: 4,
          table1__column3: null,
          table1__many_to_one_id: 'y',
          table1__many_to_one_recursive_id: 4,
          table1__one_to_one_id: null,
          table1__one_to_one_recursive_id: null,
          table1__one_to_many_recursive_id: null,
          table1__manyToOne__id: 'y',
          table1__manyToOne__column1: 'e',
          table1__manyToOne__column2: 5,
          table1__manyToOne__column3: null,
          table1__manyToOne__one_to_one_id: null,
          table1__manyToOne__one_to_many_id: null,
          table1__manyToOneRecursive__id: 4,
          table1__manyToOneRecursive__column1: 'f',
          table1__manyToOneRecursive__column2: 6,
          table1__manyToOneRecursive__column3: null,
          table1__manyToOneRecursive__many_to_one_id: null,
          table1__manyToOneRecursive__many_to_one_recursive_id: null,
          table1__manyToOneRecursive__one_to_one_id: null,
          table1__manyToOneRecursive__one_to_one_recursive_id: null,
          table1__manyToOneRecursive__one_to_many_recursive_id: null,
        },
        {
          table1__id: 5,
          table1__column1: 'g',
          table1__column2: 7,
          table1__column3: null,
          table1__many_to_one_id: null,
          table1__many_to_one_recursive_id: null,
          table1__one_to_one_id: null,
          table1__one_to_one_recursive_id: null,
          table1__one_to_many_recursive_id: null,
          table1__manyToOne__id: null,
          table1__manyToOne__column1: null,
          table1__manyToOne__column2: null,
          table1__manyToOne__column3: null,
          table1__manyToOne__one_to_one_id: null,
          table1__manyToOne__one_to_many_id: null,
          table1__manyToOneRecursive__id: null,
          table1__manyToOneRecursive__column1: null,
          table1__manyToOneRecursive__column2: null,
          table1__manyToOneRecursive__column3: null,
          table1__manyToOneRecursive__many_to_one_id: null,
          table1__manyToOneRecursive__many_to_one_recursive_id: null,
          table1__manyToOneRecursive__one_to_one_id: null,
          table1__manyToOneRecursive__one_to_one_recursive_id: null,
          table1__manyToOneRecursive__one_to_many_recursive_id: null,
        }
      ]

      let criteria = { manyToOne: { '@load': true }, manyToOneRecursive: { '@load': true } }

      let unjoinedRows = unjoinRows(schema, 'table1', rows, criteria, 'table1__')

      expect(unjoinedRows.length).to.equal(3)

      expect(unjoinedRows[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1,
        column3: null,
        many_to_one_id: 'x',
        many_to_one_recursive_id: 2,
        one_to_one_id: null,
        one_to_one_recursive_id: null,
        one_to_many_recursive_id: null,
        manyToOne: {
          id: 'x',
          column1: 'b',
          column2: 2,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: null
        },
        manyToOneRecursive: {
          id: 2,
          column1: 'c',
          column2: 3,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        }
      })

      expect(unjoinedRows[1]).to.deep.equal({
        id: 3,
        column1: 'd',
        column2: 4,
        column3: null,
        many_to_one_id: 'y',
        many_to_one_recursive_id: 4,
        one_to_one_id: null,
        one_to_one_recursive_id: null,
        one_to_many_recursive_id: null,
        manyToOne: {
          id: 'y',
          column1: 'e',
          column2: 5,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: null
        },
        manyToOneRecursive: {
          id: 4,
          column1: 'f',
          column2: 6,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        }
      })

      expect(unjoinedRows[2]).to.deep.equal({
        id: 5,
        column1: 'g',
        column2: 7,
        column3: null,
        many_to_one_id: null,
        many_to_one_recursive_id: null,
        one_to_one_id: null,
        one_to_one_recursive_id: null,
        one_to_many_recursive_id: null,
        manyToOne: null,
        manyToOneRecursive: null
      })
    })

    it('should unjoin one-to-one relationships', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__column3: null,
          table1__many_to_one_id: null,
          table1__many_to_one_recursive_id: null,
          table1__one_to_one_id: 'x',
          table1__one_to_one_recursive_id: 2,
          table1__one_to_many_recursive_id: null,
          table1__oneToOne__id: 'x',
          table1__oneToOne__column1: 'b',
          table1__oneToOne__column2: 2,
          table1__oneToOne__column3: null,
          table1__oneToOne__one_to_one_id: 1,
          table1__oneToOne__one_to_many_id: null,
          table1__oneToOneRecursive__id: 2,
          table1__oneToOneRecursive__column1: 'c',
          table1__oneToOneRecursive__column2: 3,
          table1__oneToOneRecursive__column3: null,
          table1__oneToOneRecursive__many_to_one_id: null,
          table1__oneToOneRecursive__many_to_one_recursive_id: null,
          table1__oneToOneRecursive__one_to_one_id: null,
          table1__oneToOneRecursive__one_to_one_recursive_id: 1,
          table1__oneToOneRecursive__one_to_many_recursive_id: null,
        },
        {
          table1__id: 3,
          table1__column1: 'd',
          table1__column2: 4,
          table1__column3: null,
          table1__many_to_one_id: null,
          table1__many_to_one_recursive_id: null,
          table1__one_to_one_id: 'y',
          table1__one_to_one_recursive_id: 4,
          table1__one_to_many_recursive_id: null,
          table1__oneToOne__id: 'y',
          table1__oneToOne__column1: 'e',
          table1__oneToOne__column2: 5,
          table1__oneToOne__column3: null,
          table1__oneToOne__one_to_one_id: 3,
          table1__oneToOne__one_to_many_id: null,
          table1__oneToOneRecursive__id: 4,
          table1__oneToOneRecursive__column1: 'f',
          table1__oneToOneRecursive__column2: 6,
          table1__oneToOneRecursive__column3: null,
          table1__oneToOneRecursive__many_to_one_id: null,
          table1__oneToOneRecursive__many_to_one_recursive_id: null,
          table1__oneToOneRecursive__one_to_one_id: null,
          table1__oneToOneRecursive__one_to_one_recursive_id: 3,
          table1__oneToOneRecursive__one_to_many_recursive_id: null,
        },
        {
          table1__id: 5,
          table1__column1: 'g',
          table1__column2: 7,
          table1__column3: null,
          table1__many_to_one_id: null,
          table1__many_to_one_recursive_id: null,
          table1__one_to_one_id: null,
          table1__one_to_one_recursive_id: null,
          table1__one_to_many_recursive_id: null,
          table1__oneToOne__id: null,
          table1__oneToOne__column1: null,
          table1__oneToOne__column2: null,
          table1__oneToOne__column3: null,
          table1__oneToOne__one_to_one_id: null,
          table1__oneToOne__one_to_many_id: null,
          table1__oneToOneRecursive__id: null,
          table1__oneToOneRecursive__column1: null,
          table1__oneToOneRecursive__column2: null,
          table1__oneToOneRecursive__column3: null,
          table1__oneToOneRecursive__many_to_one_id: null,
          table1__oneToOneRecursive__many_to_one_recursive_id: null,
          table1__oneToOneRecursive__one_to_one_id: null,
          table1__oneToOneRecursive__one_to_one_recursive_id: null,
          table1__oneToOneRecursive__one_to_many_recursive_id: null,
        }
      ]

      let criteria = { oneToOne: { '@load': true }, oneToOneRecursive: { '@load': true } }

      let unjoinedRows = unjoinRows(schema, 'table1', rows, criteria, 'table1__')

      expect(unjoinedRows.length).to.equal(3)

      expect(unjoinedRows[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1,
        column3: null,
        many_to_one_id: null,
        many_to_one_recursive_id: null,
        one_to_one_id: 'x',
        one_to_one_recursive_id: 2,
        one_to_many_recursive_id: null,
        oneToOne: {
          id: 'x',
          column1: 'b',
          column2: 2,
          column3: null,
          one_to_one_id: 1,
          one_to_many_id: null
        },
        oneToOneRecursive: {
          id: 2,
          column1: 'c',
          column2: 3,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: 1,
          one_to_many_recursive_id: null
        }
      })

      expect(unjoinedRows[1]).to.deep.equal({
        id: 3,
        column1: 'd',
        column2: 4,
        column3: null,
        many_to_one_id: null,
        many_to_one_recursive_id: null,
        one_to_one_id: 'y',
        one_to_one_recursive_id: 4,
        one_to_many_recursive_id: null,
        oneToOne: {
          id: 'y',
          column1: 'e',
          column2: 5,
          column3: null,
          one_to_one_id: 3,
          one_to_many_id: null
        },
        oneToOneRecursive: {
          id: 4,
          column1: 'f',
          column2: 6,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: 3,
          one_to_many_recursive_id: null
        }
      })

      expect(unjoinedRows[2]).to.deep.equal({
        id: 5,
        column1: 'g',
        column2: 7,
        column3: null,
        many_to_one_id: null,
        many_to_one_recursive_id: null,
        one_to_one_id: null,
        one_to_one_recursive_id: null,
        one_to_many_recursive_id: null,
        oneToOne: null,
        oneToOneRecursive: null
      })
    })

    it('should unjoin one-to-many relationships', function() {
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
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__table1_id: null,
          table1__table2_id: null,
          table1__manyObjects__table1_id: 1,
          table1__manyObjects__table2_id: null,
          table1__manyObjects__column1: 'd',
          table1__manyObjects__table1_id2: null,
          table1__manyObjects__object2__id: null,
          table1__manyObjects__object2__column1: null,
          table1__manyObjects__object2__table1_id: null
        },
        {
          table1__id: 2,
          table1__column1: 'e',
          table1__column2: 2,
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

      let criteria = { manyObjects: { '@load': true, object2: { '@load': true } }}

      let instances = unjoinRows(schema, 'table1', rows, criteria, 'table1__')

      expect(instances.length).to.equal(2)
      expect(instances[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1,
        table1_id: null,
        table2_id: null,
        manyObjects: [
          {
            table1_id: 1,
            table2_id: 1,
            column1: 'b',
            table1_id2: null,
            object2: {
              id: 1,
              column1: 'c',
              table1_id: null
            }
          },
          {
            table1_id: 1,
            table2_id: null,
            column1: 'd',
            table1_id2: null,
            object2: null
          }
        ]
      })

      expect(instances[1]).to.deep.equal({
        id: 2,
        column1: 'e',
        column2: 2,
        table1_id: null,
        table2_id: null,
        manyObjects: []
      })
    })

    it('should not unjoin a more complex example', function() {
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

      let criteria = { manyObjects: { '@load': true, object2: { '@load': true, manyObjects: { '@load': true } }}}

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

      let criteria = { object2: { '@load': true }, manyObjects: { '@load': true, object2: { '@load': true } }}

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

      expect(rowsRepresentSameEntity(schema['many_to_many'], row3, row4)).to.be.true
      expect(rowsRepresentSameEntity(schema['many_to_many'], row3, row4)).to.be.true
    })

    it('should not detect two rows as the same entity', function() {
      let row1 = { id: 1 }
      let row2 = { id: 2, column1: 'a', column2: 1 }

      expect(rowsRepresentSameEntity(schema['table1'], row1, row2)).to.be.false
      expect(rowsRepresentSameEntity(schema['table1'], row2, row1)).to.be.false

      let row3 = { table1_id: 1, table2_id: 'x' }
      let row4 = { table1_id: 2, table2_id: 'x', column1: 'a' }

      expect(rowsRepresentSameEntity(schema['many_to_many'], row3, row4)).to.be.false
      expect(rowsRepresentSameEntity(schema['many_to_many'], row3, row4)).to.be.false
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
      let criteria = { manyToMany: { '@loadSeparately': true }}
      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToMany']).to.deep.equal({
        tableName: 'table1',
        relationshipName: 'manyToMany',
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
      let criteria = { manyToMany: { '@load': true, object1: { '@load': true }, object2: { '@loadSeparately': true }}}
      let rows = [
        { column1: 'a', column2: 1, manyToMany: [ { column1: 'a1' }, { column1: 'a2' } ] },
        { column1: 'b', column2: 2, manyToMany: [ { column1: 'b1' } ] },
        { column1: 'c', column2: 3, manyToMany: [] },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToMany.object2']).to.deep.equal({
        tableName: 'many_to_many',
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
      let criteria = { manyToMany: { object1: { '@load': true }, object2: { '@loadSeparately': true }}}
      let rows = [
        { column1: 'a', column2: 1, manyToMany: [ { column1: 'a1' }, { column1: 'a2' } ] },
        { column1: 'b', column2: 2, manyToMany: [ { column1: 'b1' } ] },
        { column1: 'c', column2: 3, manyToMany: [] },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(0)
    })

    it('should determine the relationships to load if inside an array', function() {
      let criteria = [
        { manyToMany: { '@loadSeparately': true }},
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
      expect(toLoad['.manyToMany']).to.deep.equal({
        tableName: 'table1',
        relationshipName: 'manyToMany',
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
        [ { manyToMany: { '@loadSeparately': true }} ],
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
      expect(toLoad['.manyToMany']).to.deep.equal({
        tableName: 'table1',
        relationshipName: 'manyToMany',
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
        { manyToMany: { '@loadSeparately': true, column1: 'a' }},
        'XOR',
        { manyToMany: { '@loadSeparately': true, column1: 'b' }}
      ]

      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoad(schema, 'table1', rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToMany']).to.deep.equal({
        tableName: 'table1',
        relationshipName: 'manyToMany',
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
