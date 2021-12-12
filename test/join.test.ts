import { expect } from 'chai'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { unjoinRows } from '../src/join'
import { schema } from './testSchema'

let pool: Pool = new Pool({
  host: 'postgres',
  database: 'sqlorm_test',
  user: 'sqlorm_test',
  password: 'sqlorm_test'
} as PoolConfig)

function pgQueryFn(sqlString: string, values?: any[]): Promise<any> {
  return pool.query(sqlString, values)
}

describe('row', function() {
  after(async function() {
    await pool.end()
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
      let instances = unjoinRows(schema.getTable('table1'), rows, criteria, true, 'table1__')

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
      let instances = unjoinRows(schema.getTable('table1'), rows, criteria, true, 'table1__')

      expect(instances.length).to.equal(0)
    })

    it('should unjoin many-to-one relationships', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__column3: null,
          table1__many_to_one_object2_id: 'x',
          table1__many_to_one_object1_id: 2,
          table1__one_to_one_object2_id: null,
          table1__one_to_one_object1_id: null,
          table1__one_to_many_object1_many_to_one_id: null,
          table1__manyToOneObject1__id: 2,
          table1__manyToOneObject1__column1: 'c',
          table1__manyToOneObject1__column2: 3,
          table1__manyToOneObject1__column3: null,
          table1__manyToOneObject1__many_to_one_object2_id: null,
          table1__manyToOneObject1__many_to_one_object1_id: null,
          table1__manyToOneObject1__one_to_one_object2_id: null,
          table1__manyToOneObject1__one_to_one_object1_id: null,
          table1__manyToOneObject1__one_to_many_object1_many_to_one_id: null,
          table1__manyToOneObject2__id: 'x',
          table1__manyToOneObject2__column1: 'b',
          table1__manyToOneObject2__column2: 2,
          table1__manyToOneObject2__column3: null,
          table1__manyToOneObject2__one_to_one_object1_id: null,
          table1__manyToOneObject2__one_to_many_object2_many_to_one_id: null,
        },
        {
          table1__id: 3,
          table1__column1: 'd',
          table1__column2: 4,
          table1__column3: null,
          table1__many_to_one_object2_id: 'y',
          table1__many_to_one_object1_id: 4,
          table1__one_to_one_object2_id: null,
          table1__one_to_one_object1_id: null,
          table1__one_to_many_object1_many_to_one_id: null,
          table1__manyToOneObject1__id: 4,
          table1__manyToOneObject1__column1: 'f',
          table1__manyToOneObject1__column2: 6,
          table1__manyToOneObject1__column3: null,
          table1__manyToOneObject1__many_to_one_object2_id: null,
          table1__manyToOneObject1__many_to_one_object1_id: null,
          table1__manyToOneObject1__one_to_one_object2_id: null,
          table1__manyToOneObject1__one_to_one_object1_id: null,
          table1__manyToOneObject1__one_to_many_object1_many_to_one_id: null,
          table1__manyToOneObject2__id: 'y',
          table1__manyToOneObject2__column1: 'e',
          table1__manyToOneObject2__column2: 5,
          table1__manyToOneObject2__column3: null,
          table1__manyToOneObject2__one_to_one_object1_id: null,
          table1__manyToOneObject2__one_to_many_object2_many_to_one_id: null,
        },
        {
          table1__id: 5,
          table1__column1: 'g',
          table1__column2: 7,
          table1__column3: null,
          table1__many_to_one_object2_id: null,
          table1__many_to_one_object1_id: null,
          table1__one_to_one_object2_id: null,
          table1__one_to_one_object1_id: null,
          table1__one_to_many_object1_many_to_one_id: null,
          table1__manyToOneObject1__id: null,
          table1__manyToOneObject1__column1: null,
          table1__manyToOneObject1__column2: null,
          table1__manyToOneObject1__column3: null,
          table1__manyToOneObject1__many_to_one_object2_id: null,
          table1__manyToOneObject1__many_to_one_object1_id: null,
          table1__manyToOneObject1__one_to_one_object2_id: null,
          table1__manyToOneObject1__one_to_one_object1_id: null,
          table1__manyToOneObject1__one_to_many_object1_many_to_one_id: null,
          table1__manyToOneObject2__id: null,
          table1__manyToOneObject2__column1: null,
          table1__manyToOneObject2__column2: null,
          table1__manyToOneObject2__column3: null,
          table1__manyToOneObject2__one_to_one_object1_id: null,
          table1__manyToOneObject2__one_to_many_object2_many_to_one_id: null,
        }
      ]

      let criteria = { manyToOneObject2: { '@load': true }, manyToOneObject1: { '@load': true } }

      let unjoinedRows = unjoinRows(schema.getTable('table1'), rows, criteria, true, 'table1__')

      expect(unjoinedRows.length).to.equal(3)

      expect(unjoinedRows[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1,
        column3: null,
        many_to_one_object1_id: 2,
        many_to_one_object2_id: 'x',
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject2: {
          id: 'x',
          column1: 'b',
          column2: 2,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        },
        manyToOneObject1: {
          id: 2,
          column1: 'c',
          column2: 3,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }
      })

      expect(unjoinedRows[1]).to.deep.equal({
        id: 3,
        column1: 'd',
        column2: 4,
        column3: null,
        many_to_one_object1_id: 4,
        many_to_one_object2_id: 'y',
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject2: {
          id: 'y',
          column1: 'e',
          column2: 5,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        },
        manyToOneObject1: {
          id: 4,
          column1: 'f',
          column2: 6,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }
      })

      expect(unjoinedRows[2]).to.deep.equal({
        id: 5,
        column1: 'g',
        column2: 7,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: null,
        manyToOneObject2: null,
      })
    })

    it('should unjoin one-to-one relationships', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__column3: null,
          table1__many_to_one_object2_id: null,
          table1__many_to_one_object1_id: null,
          table1__one_to_one_object2_id: 'x',
          table1__one_to_one_object1_id: 2,
          table1__one_to_many_object1_many_to_one_id: null,
          table1__oneToOneObject1__id: 2,
          table1__oneToOneObject1__column1: 'c',
          table1__oneToOneObject1__column2: 3,
          table1__oneToOneObject1__column3: null,
          table1__oneToOneObject1__many_to_one_object2_id: null,
          table1__oneToOneObject1__many_to_one_object1_id: null,
          table1__oneToOneObject1__one_to_one_object2_id: null,
          table1__oneToOneObject1__one_to_one_object1_id: 1,
          table1__oneToOneObject1__one_to_many_object1_many_to_one_id: null,
          table1__oneToOneObject2__id: 'x',
          table1__oneToOneObject2__column1: 'b',
          table1__oneToOneObject2__column2: 2,
          table1__oneToOneObject2__column3: null,
          table1__oneToOneObject2__one_to_one_object1_id: 1,
          table1__oneToOneObject2__one_to_many_object2_many_to_one_id: null,
        },
        {
          table1__id: 3,
          table1__column1: 'd',
          table1__column2: 4,
          table1__column3: null,
          table1__many_to_one_object2_id: null,
          table1__many_to_one_object1_id: null,
          table1__one_to_one_object2_id: 'y',
          table1__one_to_one_object1_id: 4,
          table1__one_to_many_object1_many_to_one_id: null,
          table1__oneToOneObject1__id: 4,
          table1__oneToOneObject1__column1: 'f',
          table1__oneToOneObject1__column2: 6,
          table1__oneToOneObject1__column3: null,
          table1__oneToOneObject1__many_to_one_object2_id: null,
          table1__oneToOneObject1__many_to_one_object1_id: null,
          table1__oneToOneObject1__one_to_one_object2_id: null,
          table1__oneToOneObject1__one_to_one_object1_id: 3,
          table1__oneToOneObject1__one_to_many_object1_many_to_one_id: null,
          table1__oneToOneObject2__id: 'y',
          table1__oneToOneObject2__column1: 'e',
          table1__oneToOneObject2__column2: 5,
          table1__oneToOneObject2__column3: null,
          table1__oneToOneObject2__one_to_one_object1_id: 3,
          table1__oneToOneObject2__one_to_many_object2_many_to_one_id: null,
        },
        {
          table1__id: 5,
          table1__column1: 'g',
          table1__column2: 7,
          table1__column3: null,
          table1__many_to_one_object2_id: null,
          table1__many_to_one_object1_id: null,
          table1__one_to_one_object2_id: null,
          table1__one_to_one_object1_id: null,
          table1__one_to_many_object1_many_to_one_id: null,
          table1__oneToOneObject1__id: null,
          table1__oneToOneObject1__column1: null,
          table1__oneToOneObject1__column2: null,
          table1__oneToOneObject1__column3: null,
          table1__oneToOneObject1__many_to_one_object2_id: null,
          table1__oneToOneObject1__many_to_one_object1_id: null,
          table1__oneToOneObject1__one_to_one_object2_id: null,
          table1__oneToOneObject1__one_to_one_object1_id: null,
          table1__oneToOneObject1__one_to_many_object1_many_to_one_id: null,
          table1__oneToOneObject2__id: null,
          table1__oneToOneObject2__column1: null,
          table1__oneToOneObject2__column2: null,
          table1__oneToOneObject2__column3: null,
          table1__oneToOneObject2__one_to_one_object1_id: null,
          table1__oneToOneObject2__one_to_many_object2_many_to_one_id: null,
        }
      ]

      let criteria = { oneToOneObject2: { '@load': true }, oneToOneObject1: { '@load': true } }

      let unjoinedRows = unjoinRows(schema.getTable('table1'), rows, criteria, true, 'table1__')

      expect(unjoinedRows.length).to.equal(3)

      expect(unjoinedRows[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 2,
        one_to_one_object2_id: 'x',
        one_to_many_object1_many_to_one_id: null,
        oneToOneObject2: {
          id: 'x',
          column1: 'b',
          column2: 2,
          column3: null,
          one_to_one_object1_id: 1,
          one_to_many_object2_many_to_one_id: null
        },
        oneToOneObject1: {
          id: 2,
          column1: 'c',
          column2: 3,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 1,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }
      })

      expect(unjoinedRows[1]).to.deep.equal({
        id: 3,
        column1: 'd',
        column2: 4,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 4,
        one_to_one_object2_id: 'y',
        one_to_many_object1_many_to_one_id: null,
        oneToOneObject2: {
          id: 'y',
          column1: 'e',
          column2: 5,
          column3: null,
          one_to_one_object1_id: 3,
          one_to_many_object2_many_to_one_id: null
        },
        oneToOneObject1: {
          id: 4,
          column1: 'f',
          column2: 6,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 3,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }
      })

      expect(unjoinedRows[2]).to.deep.equal({
        id: 5,
        column1: 'g',
        column2: 7,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToOneObject1: null,
        oneToOneObject2: null,
      })
    })

    it('should unjoin one-to-many relationships', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__manyToManyObject2__table1_id: 1,
          table1__manyToManyObject2__table2_id: 1,
          table1__manyToManyObject2__column1: 'b',
          table1__manyToManyObject2__object2__id: 1,
          table1__manyToManyObject2__object2__column1: 'c',
          table1__manyToManyObject2__object2__table1_id: null
        },
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__table1_id: null,
          table1__table2_id: null,
          table1__manyToManyObject2__table1_id: 1,
          table1__manyToManyObject2__table2_id: null,
          table1__manyToManyObject2__column1: 'd',
          table1__manyToManyObject2__object2__id: null,
          table1__manyToManyObject2__object2__column1: null,
          table1__manyToManyObject2__object2__table1_id: null
        },
        {
          table1__id: 2,
          table1__column1: 'e',
          table1__column2: 2,
          table1__manyToManyObject2__table1_id: null,
          table1__manyToManyObject2__table2_id: null,
          table1__manyToManyObject2__column1: null,
          table1__manyToManyObject2__object2__id: null,
          table1__manyToManyObject2__object2__column1: null,
          table1__manyToManyObject2__object2__table1_id: null
        }
      ]

      let criteria = { manyToManyObject2: { '@load': true, object2: { '@load': true } }}

      let instances = unjoinRows(schema.getTable('table1'), rows, criteria, true, 'table1__')

      expect(instances.length).to.equal(2)
      expect(instances[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1,
        manyToManyObject2: [
          {
            table1_id: 1,
            table2_id: 1,
            column1: 'b',
            object2: {
              id: 1,
              column1: 'c',
              table1_id: null
            }
          },
          {
            table1_id: 1,
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
        manyToManyObject2: []
      })
    })

    it('should not unjoin a more complex example', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__manyToManyObject2__table1_id: 1,
          table1__manyToManyObject2__table2_id: 'x',
          table1__manyToManyObject2__column1: 'b',
          table1__manyToManyObject2__object2__id: 'x',
          table1__manyToManyObject2__object2__column1: 'c',
          table1__manyToManyObject2__object2__table1_id: null,
          table1__manyToManyObject2__object2__manyToManyObject2__table1_id: 2,
          table1__manyToManyObject2__object2__manyToManyObject2__table2_id: 'x',
          table1__manyToManyObject2__object2__manyToManyObject2__column1: 'd',
          table1__manyToManyObject2__object2__manyToManyObject2__table1_id2: null,
        },
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__manyToManyObject2__table1_id: 1,
          table1__manyToManyObject2__table2_id: 'x',
          table1__manyToManyObject2__column1: 'b',
          table1__manyToManyObject2__object2__id: 'x',
          table1__manyToManyObject2__object2__column1: 'c',
          table1__manyToManyObject2__object2__table1_id: null,
          table1__manyToManyObject2__object2__manyToManyObject2__table1_id: 3,
          table1__manyToManyObject2__object2__manyToManyObject2__table2_id: 'x',
          table1__manyToManyObject2__object2__manyToManyObject2__column1: 'e',
          table1__manyToManyObject2__object2__manyToManyObject2__table1_id2: null,
        }
      ]

      let criteria = { manyToManyObject2: { '@load': true, object2: { '@load': true, manyToManyObject2: { '@load': true } }}}

      let instances = unjoinRows(schema.getTable('table1'), rows, criteria, true, 'table1__')

      expect(instances.length).to.equal(1)
      expect(instances[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: 1,
        manyToManyObject2: [{
          table1_id: 1,
          table2_id: 'x',
          column1: 'b',
          object2: {
            id: 'x',
            column1: 'c',
            table1_id: null,
            manyToManyObject2: [
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
          table1__manyToManyObject2__table1_id: null,
          table1__manyToManyObject2__table2_id: null,
          table1__manyToManyObject2__column1: null,
          table1__manyToManyObject2__table1_id2: null,
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
          table1__manyToManyObject2__table1_id: null,
          table1__manyToManyObject2__table2_id: null,
          table1__manyToManyObject2__column1: null,
          table1__manyToManyObject2__table1_id2: null,
        }
      ]

      let criteria = { object2: { '@load': true }, manyToManyObject2: { '@load': true, object2: { '@load': true } }}

      let instances = unjoinRows(schema.getTable('table1'), rows, criteria, true, 'table1__')

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
        manyToManyObject2: []
      } as any

      expect(instances[0]).to.deep.equal(expectedInstance)
    })
  })
})
