import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import { Change } from 'knight-change'
import 'mocha'
import { Orm, SelectResult } from '../../src'
import { Object1, schema } from '../testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

export function storeRowTests(db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any>) {  
  let orm = new Orm(schema, db)
  
  describe('store (row)', function() {
    it('insert simple object', async function() {
      let row = {
        column1: 'a'
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert')
      ])

      let result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(result.length).to.equal(1)
      expect(result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })
    })

    it('insert many-to-one primary key generated', async function() {
      let row = {
        column1: 'a',
        manyToOneObject1: {
          column1: 'b'
        }
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 2,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 1,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }
      })

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 2,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: 1,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(2)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('insert many-to-one primary key not generated', async function() {
      let row = {
        column1: 'a',
        manyToOneObject2: {
          id: 'x',
          column1: 'b'
        }
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: 'x',
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject2: {
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        }
      })

      expect(changes).to.deep.equal([
        new Change('table2', {
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: 'x',
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: 'x',
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'b',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('insert one-to-one primary key generated', async function() {
      let row = {
        column1: 'a',
        oneToOneObject1: {
          column1: 'b'
        }
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 2,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 1,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToOneObject1: {
          id: 1,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 2,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }
      })

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 2,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 1,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 1,
          one_to_one_object1_id: 2
        }, 'update', [ 'one_to_one_object1_id' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(2)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 2,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 1,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('insert one-to-one primary key generated references back', async function() {
      let row = {
        column1: 'a',
        oneToOneObject1: {
          column1: 'b',
          oneToOneObject1: {}
        }
      }

      row.oneToOneObject1.oneToOneObject1 = row

      let changes = await orm.store(queryFn, Object1, row, true)

      let expectedRow = {
        id: 2,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 1,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToOneObject1: {
          id: 1,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 2,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        } as any
      }
      
      expectedRow.oneToOneObject1.oneToOneObject1 = expectedRow

      expect(row).to.deep.equal(expectedRow)

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 2,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 1,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 1,
          one_to_one_object1_id: 2
        }, 'update', [ 'one_to_one_object1_id' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(2)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 2,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 1,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('insert one-to-one references the same entity', async function() {
      let row = {
        column1: 'a',
        oneToOneObject1: {}
      }

      row.oneToOneObject1 = row

      let changes = await orm.store(queryFn, Object1, row, true)

      let expectedRow = {
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 1,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      } as any
      
      expectedRow.oneToOneObject1 = expectedRow

      expect(row).to.deep.equal(expectedRow)

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 1,
          one_to_one_object1_id: 1
        }, 'update', [ 'one_to_one_object1_id' ]),
        new Change('table1', {
          id: 1,
          one_to_one_object1_id: 1
        }, 'update', [ 'one_to_one_object1_id' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 1,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('insert one-to-one primary key not generated', async function() {
      let row = {
        column1: 'a',
        oneToOneObject2: {
          id: 'x',
          column1: 'b'
        }
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: 'x',
        one_to_many_object1_many_to_one_id: null,
        oneToOneObject2: {
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: 1,
          one_to_many_object2_many_to_one_id: null
        }
      })

      expect(changes).to.deep.equal([
        new Change('table2', {
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: 'x',
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table2', {
          id: 'x',
          one_to_one_object1_id: 1
        }, 'update', [ 'one_to_one_object1_id' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: 'x',
        one_to_many_object1_many_to_one_id: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'b',
        column2: null,
        column3: null,
        one_to_one_object1_id: 1,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('insert one-to-one primary key not generated references back', async function() {
      let row = {
        column1: 'a',
        oneToOneObject2: {
          id: 'x',
          column1: 'b',
          oneToOneObject1: {}
        }
      }

      row.oneToOneObject2.oneToOneObject1 = row

      let changes = await orm.store(queryFn, Object1, row, true)

      let expectObj1 = {
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: 'x',
        one_to_many_object1_many_to_one_id: null,
        oneToOneObject2: {
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: 1,
          one_to_many_object2_many_to_one_id: null
        } as any
      }

      expectObj1.oneToOneObject2.oneToOneObject1 = expectObj1

      expect(row).to.deep.equal(expectObj1)

      expect(changes).to.deep.equal([
        new Change('table2', {
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: 'x',
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table2', {
          id: 'x',
          one_to_one_object1_id: 1
        }, 'update', [ 'one_to_one_object1_id' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: 'x',
        one_to_many_object1_many_to_one_id: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'b',
        column2: null,
        column3: null,
        one_to_one_object1_id: 1,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('insert one-to-many primary key generated', async function() {
      let row = {
        column1: 'a',
        oneToManyObject1: [
          {
            column1: 'b'
          },
          {
            column1: 'c'
          }
        ]
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject1: [
          {
            id: 2,
            column1: 'b',
            column2: null,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: 1
          },
          {
            id: 3,
            column1: 'c',
            column2: null,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: 1
          }
        ]
      })

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 2,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: 1
        }, 'insert'),
        new Change('table1', {
          id: 3,
          column1: 'c',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: 1
        }, 'insert')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: 1
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'c',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: 1
      })
    })

    it('insert one-to-many primary key generated references back', async function() {
      let row = {
        column1: 'a',
        oneToManyObject1: [
          {
            column1: 'b',
            oneToManyObject1ManyToOne: {}
          },
          {
            column1: 'c',
            oneToManyObject1ManyToOne: {}
          }
        ]
      }

      row.oneToManyObject1[0].oneToManyObject1ManyToOne = row
      row.oneToManyObject1[1].oneToManyObject1ManyToOne = row
      
      let changes = await orm.store(queryFn, Object1, row, true)

      let expectedRow = {
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject1: [
          {
            id: 2,
            column1: 'b',
            column2: null,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: 1,
          } as any,
          {
            id: 3,
            column1: 'c',
            column2: null,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: 1,
          }
        ]
      }

      expectedRow.oneToManyObject1[0].oneToManyObject1ManyToOne = expectedRow
      expectedRow.oneToManyObject1[1].oneToManyObject1ManyToOne = expectedRow

      expect(row).to.deep.equal(expectedRow)

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 2,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: 1
        }, 'insert'),
        new Change('table1', {
          id: 3,
          column1: 'c',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: 1
        }, 'insert')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: 1
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'c',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: 1
      })
    })

    it('insert one-to-many primary key not generated', async function() {
      let row = {
        column1: 'a',
        oneToManyObject2: [
          {
            id: 'x',
            column1: 'b'
          },
          {
            id: 'y',
            column1: 'c'
          }
        ]
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject2: [
          {
            id: 'x',
            column1: 'b',
            column2: null,
            column3: null,
            one_to_one_object1_id: null,
            one_to_many_object2_many_to_one_id: 1
            } as any,
          {
            id: 'y',
            column1: 'c',
            column2: null,
            column3: null,
            one_to_one_object1_id: null,
            one_to_many_object2_many_to_one_id: 1
            }
        ]
      })

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table2', {
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: 1
        }, 'insert'),
          new Change('table2', {
            id: 'y',
            column1: 'c',
            column2: null,
            column3: null,
            one_to_one_object1_id: null,
            one_to_many_object2_many_to_one_id: 1
        }, 'insert')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(2)
      
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'b',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'y',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })
    })

    it('insert one-to-many primary key not generated references back', async function() {
      let row = {
        column1: 'a',
        oneToManyObject2: [
          {
            id: 'x',
            column1: 'b',
            oneToManyObject2ManyToOne: {}
          },
          {
            id: 'y',
            column1: 'c',
            oneToManyObject2ManyToOne: {}
          }
        ]
      }

      row.oneToManyObject2[0].oneToManyObject2ManyToOne = row
      row.oneToManyObject2[1].oneToManyObject2ManyToOne = row

      let changes = await orm.store(queryFn, Object1, row, true)

      let expectedRow = {
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject2: [
          {
            id: 'x',
            column1: 'b',
            column2: null,
            column3: null,
            one_to_one_object1_id: null,
            one_to_many_object2_many_to_one_id: 1
            } as any,
          {
            id: 'y',
            column1: 'c',
            column2: null,
            column3: null,
            one_to_one_object1_id: null,
            one_to_many_object2_many_to_one_id: 1
          }
        ]
      }

      expectedRow.oneToManyObject2[0].oneToManyObject2ManyToOne = expectedRow
      expectedRow.oneToManyObject2[1].oneToManyObject2ManyToOne = expectedRow

      expect(row).to.deep.equal(expectedRow)

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table2', {
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: 1
        }, 'insert'),
          new Change('table2', {
            id: 'y',
            column1: 'c',
            column2: null,
            column3: null,
            one_to_one_object1_id: null,
            one_to_many_object2_many_to_one_id: 1
        }, 'insert')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(2)
      
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'b',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'y',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })
    })

    it('insert one-to-many references same entity', async function() {
      let row = {
        column1: 'a',
        oneToManyObject1: null
      } as any

      row.oneToManyObject1 = [ row ]

      let changes = await orm.store(queryFn, Object1, row, true)

      let expectedRow = {
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: 1,
        oneToManyObject1: null
      } as any

      expectedRow.oneToManyObject1 = [ expectedRow ]

      expect(row).to.deep.equal(expectedRow)

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 1,
          one_to_many_object1_many_to_one_id: 1
        }, 'update', [ 'one_to_many_object1_many_to_one_id' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: 1
      })
    })

    it('insert many-to-many primary key generated', async function() {
      let row = {
        column1: 'a',
        manyToManyObject1: [
          {
            column1: 'b',
            object12: {
              column1: 'c'
            }
          },
          {
            column1: 'd',
            object12: {
              column1: 'e'
            }
          }
        ]
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToManyObject1: [
          {
            table1_id1: 1,
            table1_id2: 2,
            column1: 'b',
            column2: null,
            column3: null,
            object12: {
              id: 2,
              column1: 'c',
              column2: null,
              column3: null,
              many_to_one_object1_id: null,
              many_to_one_object2_id: null,
              one_to_one_object1_id: null,
              one_to_one_object2_id: null,
              one_to_many_object1_many_to_one_id: null
            }
          },
          {
            table1_id1: 1,
            table1_id2: 3,
            column1: 'd',
            column2: null,
            column3: null,
            object12: {
              id: 3,
              column1: 'e',
              column2: null,
              column3: null,
              many_to_one_object1_id: null,
              many_to_one_object2_id: null,
              one_to_one_object1_id: null,
              one_to_one_object2_id: null,
              one_to_many_object1_many_to_one_id: null
            }
          }
        ]
      })

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 2,
          column1: 'c',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('many_to_many_table1', {
          table1_id1: 1,
          table1_id2: 2,
          column1: 'b',
          column2: null,
          column3: null,
        }, 'insert'),
        new Change('table1', {
          id: 3,
          column1: 'e',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('many_to_many_table1', {
          table1_id1: 1,
          table1_id2: 3,
          column1: 'd',
          column2: null,
          column3: null,
        }, 'insert'),
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'c',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'e',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      let tableManyResult = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM many_to_many_table1 ORDER BY table1_id1') as SelectResult

      expect(tableManyResult.length).to.equal(2)

      expect(tableManyResult[0]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 2,
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 3,
        column1: 'd',
        column2: null,
        column3: null
      })
    })

    it('insert many-to-many primary key generated references back', async function() {
      let row = {
        column1: 'a',
        manyToManyObject1: [
          {
            column1: 'b',
            object11: {},
            object12: {
              column1: 'c'
            } as any
          },
          {
            column1: 'd',
            object11: {},
            object12: {
              column1: 'e'
            }
          }
        ]
      }

      row.manyToManyObject1[0].object11 = row
      row.manyToManyObject1[0].object12.manyToManyObject1 = [ row.manyToManyObject1[0] ]
      row.manyToManyObject1[1].object11 = row
      row.manyToManyObject1[1].object12.manyToManyObject1 = [ row.manyToManyObject1[1] ]

      let changes = await orm.store(queryFn, Object1, row, true)

      let expectedRow = {
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToManyObject1: [
          {
            table1_id1: 1,
            table1_id2: 2,
            column1: 'b',
            column2: null,
            column3: null,
            object12: {
              id: 2,
              column1: 'c',
              column2: null,
              column3: null,
              many_to_one_object1_id: null,
              many_to_one_object2_id: null,
              one_to_one_object1_id: null,
              one_to_one_object2_id: null,
              one_to_many_object1_many_to_one_id: null
            } as any
          } as any,
          {
            table1_id1: 1,
            table1_id2: 3,
            column1: 'd',
            column2: null,
            column3: null,
            object12: {
              id: 3,
              column1: 'e',
              column2: null,
              column3: null,
              many_to_one_object1_id: null,
              many_to_one_object2_id: null,
              one_to_one_object1_id: null,
              one_to_one_object2_id: null,
              one_to_many_object1_many_to_one_id: null
            }
          }
        ]
      }

      expectedRow.manyToManyObject1[0].object11 = expectedRow
      expectedRow.manyToManyObject1[0].object12.manyToManyObject1 = [ expectedRow.manyToManyObject1[0] ]
      expectedRow.manyToManyObject1[1].object11 = expectedRow
      expectedRow.manyToManyObject1[1].object12.manyToManyObject1 = [ expectedRow.manyToManyObject1[1] ]

      expect(row).to.deep.equal(expectedRow)

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table1', {
          id: 2,
          column1: 'c',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('many_to_many_table1', {
          table1_id1: 1,
          table1_id2: 2,
          column1: 'b',
          column2: null,
          column3: null,
        }, 'insert'),
        new Change('table1', {
          id: 3,
          column1: 'e',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('many_to_many_table1', {
          table1_id1: 1,
          table1_id2: 3,
          column1: 'd',
          column2: null,
          column3: null,
        }, 'insert'),
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'c',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'e',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      let tableManyResult = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM many_to_many_table1 ORDER BY table1_id1') as SelectResult

      expect(tableManyResult.length).to.equal(2)

      expect(tableManyResult[0]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 2,
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 3,
        column1: 'd',
        column2: null,
        column3: null
      })
    })

    it('insert many-to-many references the same entity', async function() {
      let row = {
        column1: 'a',
        manyToManyObject1: [
          {
            column1: 'b',
            object12: {}
          }
        ]
      }

      row.manyToManyObject1[0].object12 = row

      let changes = await orm.store(queryFn, Object1, row, true)

      let expectedRow = {
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToManyObject1: [
          {
            table1_id1: 1,
            table1_id2: 1,
            column1: 'b',
            column2: null,
            column3: null
          } as any
        ]
      }

      expectedRow.manyToManyObject1[0].object12 = expectedRow

      expect(row).to.deep.equal(expectedRow)

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('many_to_many_table1', {
          table1_id1: 1,
          table1_id2: 1,
          column1: 'b',
          column2: null,
          column3: null,
        }, 'insert')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(1)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      let tableManyResult = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM many_to_many_table1 ORDER BY column1') as SelectResult

      expect(tableManyResult.length).to.equal(1)

      expect(tableManyResult[0]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 1,
        column1: 'b',
        column2: null,
        column3: null
      })
    })

    it('insert many-to-many primary key not generated', async function() {
      let row = {
        column1: 'a',
        manyToManyObject2: [
          {
            column1: 'b',
            object2: {
              id: 'x',
              column1: 'c'
            }
          },
          {
            column1: 'd',
            object2: {
              id: 'y',
              column1: 'e'
            }
          }
        ]
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToManyObject2: [
          {
            table1_id: 1,
            table2_id: 'x',
            column1: 'b',
            column2: null,
            column3: null,
            object2: {
              id: 'x',
              column1: 'c',
              column2: null,
              column3: null,
              one_to_one_object1_id: null,
              one_to_many_object2_many_to_one_id: null
                } as any
          } as any,
          {
            table1_id: 1,
            table2_id: 'y',
            column1: 'd',
            column2: null,
            column3: null,
            object2: {
              id: 'y',
              column1: 'e',
              column2: null,
              column3: null,
              one_to_one_object1_id: null,
              one_to_many_object2_many_to_one_id: null
            }
          }
        ]
      })

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table2', {
          id: 'x',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        }, 'insert'),
        new Change('many_to_many_table2', {
          table1_id: 1,
          table2_id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
        }, 'insert'),
        new Change('table2', {
          id: 'y',
          column1: 'e',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        }, 'insert'),
        new Change('many_to_many_table2', {
          table1_id: 1,
          table2_id: 'y',
          column1: 'd',
          column2: null,
          column3: null,
        }, 'insert'),
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      let tableManyResult = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM many_to_many_table2 ORDER BY table1_id') as SelectResult

      expect(tableManyResult.length).to.equal(2)

      expect(tableManyResult[0]).to.deep.equal({
        table1_id: 1,
        table2_id: 'x',
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id: 1,
        table2_id: 'y',
        column1: 'd',
        column2: null,
        column3: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2 ORDER BY id') as SelectResult

      expect(table2Result.length).to.equal(2)
      
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'y',
        column1: 'e',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('insert many-to-many primary key not generated references back', async function() {
      let row = {
        column1: 'a',
        manyToManyObject2: [
          {
            column1: 'b',
            object1: {},
            object2: {
              id: 'x',
              column1: 'c',
              manyToManyObject2: []
            } as any
          },
          {
            column1: 'd',
            object1: {},
            object2: {
              id: 'y',
              column1: 'e',
              manyToManyObject2: []
            }
          }
        ]
      }

      row.manyToManyObject2[0].object1 = row
      row.manyToManyObject2[0].object2.manyToManyObject2.push(row.manyToManyObject2[0])
      row.manyToManyObject2[1].object1 = row
      row.manyToManyObject2[1].object2.manyToManyObject2.push(row.manyToManyObject2[1])

      let changes = await orm.store(queryFn, Object1, row, true)

      let expectedRow = {
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToManyObject2: [
          {
            table1_id: 1,
            table2_id: 'x',
            column1: 'b',
            column2: null,
            column3: null,
            object2: {
              id: 'x',
              column1: 'c',
              column2: null,
              column3: null,
              one_to_one_object1_id: null,
              one_to_many_object2_many_to_one_id: null
                } as any
          } as any,
          {
            table1_id: 1,
            table2_id: 'y',
            column1: 'd',
            column2: null,
            column3: null,
            object2: {
              id: 'y',
              column1: 'e',
              column2: null,
              column3: null,
              one_to_one_object1_id: null,
              one_to_many_object2_many_to_one_id: null
            }
          }
        ]
      }

      expectedRow.manyToManyObject2[0].object1 = row
      expectedRow.manyToManyObject2[0].object2.manyToManyObject2 = [ expectedRow.manyToManyObject2[0] ]
      expectedRow.manyToManyObject2[1].object1 = row
      expectedRow.manyToManyObject2[1].object2.manyToManyObject2 = [ expectedRow.manyToManyObject2[1] ]

      expect(row).to.deep.equal(expectedRow)

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }, 'insert'),
        new Change('table2', {
          id: 'x',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        }, 'insert'),
        new Change('many_to_many_table2', {
          table1_id: 1,
          table2_id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
        }, 'insert'),
        new Change('table2', {
          id: 'y',
          column1: 'e',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        }, 'insert'),
        new Change('many_to_many_table2', {
          table1_id: 1,
          table2_id: 'y',
          column1: 'd',
          column2: null,
          column3: null,
        }, 'insert'),
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      let tableManyResult = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM many_to_many_table2 ORDER BY table1_id') as SelectResult

      expect(tableManyResult.length).to.equal(2)

      expect(tableManyResult[0]).to.deep.equal({
        table1_id: 1,
        table2_id: 'x',
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id: 1,
        table2_id: 'y',
        column1: 'd',
        column2: null,
        column3: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2 ORDER BY id') as SelectResult

      expect(table2Result.length).to.equal(2)
      
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'y',
        column1: 'e',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('update simple obj', async function() {
      await queryFn('INSERT INTO table1 (column1) VALUES (\'a\')')

      let row = {
        id: 1,
        column1: 'b'
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(changes).to.deep.equal([
        new Change('table1', {
          id: 1,
          column1: 'b',
        }, 'update', [ 'column1' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })
    })

    it('not update simple obj if nothing to set is given', async function() {
      await queryFn('INSERT INTO table1 (column1) VALUES (\'a\')')

      let row = {
        id: 1
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(changes).to.deep.equal([])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })
    })

    it('update many-to-one primary key not generated', async function() {
      await queryFn('INSERT INTO table1 (column1, many_to_one_object2_id) VALUES (\'a\', \'x\')')
      await queryFn('INSERT INTO table2 (id, column1) VALUES (\'x\', \'b\')')

      let row = {
        id: 1,
        column1: 'b',
        manyToOneObject2: {
          id: 'x',
          column1: 'c'
        }
      }

      let changes = await orm.store(queryFn, Object1, row, true)

      expect(row).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: 'x',
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject2: {
          id: 'x',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        }
      })

      expect(changes).to.deep.equal([
        new Change('table2', {
          id: 'x',
          column1: 'c'
        }, 'update', [ 'column1' ]),
        new Change('table1', {
          id: 1,
          column1: 'b'
        }, 'update', [ 'column1' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: 'x',
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })
  })
}
