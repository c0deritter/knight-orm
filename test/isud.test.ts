import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { delete_, insert, select } from '../src/isud'
import { schema } from './testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

let pool: Pool = new Pool({
  host: 'postgres',
  database: 'sqlorm_test',
  user: 'sqlorm_test',
  password: 'sqlorm_test'
} as PoolConfig)

describe.only('isud', function() {
  describe('PostgreSQL', function () {
    after(async function() {
      await pool.end()
    })

    beforeEach(async function() {
      await pool.query('CREATE TABLE table1 (id SERIAL, column1 VARCHAR(20), column2 INTEGER, table1_id INTEGER, table2_id VARCHAR(20))')
      await pool.query('CREATE TABLE table2 (id VARCHAR(20), column1 VARCHAR(20))')
      await pool.query('CREATE TABLE table4 (table1_id1 INTEGER, table1_id2 INTEGER)')
      await pool.query('CREATE TABLE table_many (table1_id INTEGER, table2_id VARCHAR(20), column1 VARCHAR(20), table1_id2 INTEGER)')
    })

    afterEach(async function() {
      await pool.query('DROP TABLE IF EXISTS table1 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table2 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table4 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table_many CASCADE')
    })
    
    describe('insert', function() {
      it('should insert a simple row with PostgreSQL', async function() {
        let row = {
          column1: 'a',
          column2: 1
        }
  
        let insertedRow = await insert(schema, 'table1', 'postgres', pgQueryFn, row)
  
        expect(insertedRow.id).to.equal(1)
        expect(insertedRow.column1).to.equal('a')
        expect(insertedRow.column2).to.equal(1)

        let rows = await pgQueryFn('SELECT * FROM table1')

        expect(rows.length).to.equal(1)
        expect(rows[0].id).to.equal(1)
        expect(rows[0].column1).to.equal('a')
        expect(rows[0].column2).to.equal(1)
      })
  
      it('should insert a row with a one-to-many relationship', async function() {
        let row: any = {
          column1: 'a',
          column2: 1,
          many: []
        }

        row.many.push(
          {
            column1: 'b',
            object1: row
          },
          {
            column1: 'c',
            object1: row
          }
        )

        let insertedRow = await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let expectedRow = {
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null,
          many: [
            {
              table1_id: 1,
              table2_id: null,
              column1: 'b',
              table1_id2: null
            } as any,
            {
              table1_id: 1,
              table2_id: null,
              column1: 'c',
              table1_id2: null
            }
          ]
        }

        expectedRow.many[0].object1 = expectedRow
        expectedRow.many[1].object1 = expectedRow

        expect(insertedRow.id).to.equal(1)
        expect(insertedRow).to.deep.equal(expectedRow)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('a')
        expect(table1Rows[0].column2).to.equal(1)

        let tableManyRows = await pgQueryFn('SELECT * FROM table_many')

        expect(tableManyRows.length).to.equal(2)
        expect(tableManyRows[0].table1_id).to.equal(1)
        expect(tableManyRows[0].table2_id).to.be.null
        expect(tableManyRows[0].column1).to.equal('b')
        expect(tableManyRows[0].table1_id2).to.be.null
        expect(tableManyRows[1].table1_id).to.equal(1)
        expect(tableManyRows[1].table2_id).to.be.null
        expect(tableManyRows[1].column1).to.equal('c')
        expect(tableManyRows[1].table1_id2).to.be.null

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(0)
      })

      it('should insert a row with a many-to-many relationship', async function() {
        let row: any = {
          column1: 'a',
          column2: 1,
          many: [{}, {}]
        }

        row.many[0] = {
          column1: 'b',
          object1: row,
          object2: {
            id: 'x',
            column1: 'c'
          }
        }

        row.many[0].object2.many = [ row.many[0] ]

        row.many[1] = {
          column1: 'd',
          object1: row,
          object2: {
            id: 'y',
            column1: 'e'
          }
        }

        row.many[1].object2.many = [ row.many[1] ]
        
        let insertedRow = await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let expectedRow = {
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null,
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
            }            
          ]
        }

        expectedRow.many[0].object1 = expectedRow
        expectedRow.many[1].object1 = expectedRow

        expect(insertedRow).to.deep.equal(expectedRow)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('a')
        expect(table1Rows[0].column2).to.equal(1)

        let tableManyRows = await pgQueryFn('SELECT * FROM table_many')

        expect(tableManyRows.length).to.equal(2)
        expect(tableManyRows[0].table1_id).to.equal(1)
        expect(tableManyRows[0].table2_id).to.equal('x')
        expect(tableManyRows[0].column1).to.equal('b')
        expect(tableManyRows[0].table1_id2).to.be.null
        expect(tableManyRows[1].table1_id).to.equal(1)
        expect(tableManyRows[1].table2_id).to.equal('y')
        expect(tableManyRows[1].column1).to.equal('d')
        expect(tableManyRows[1].table1_id2).to.be.null

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(2)
        expect(table2Rows[0].id).to.equal('x')
        expect(table2Rows[0].column1).to.equal('c')
        expect(table2Rows[1].id).to.equal('y')
        expect(table2Rows[1].column1).to.equal('e')
      })

      it('should insert a row with a many-to-many relationship where both id\'s refer to the same table and only one is set', async function() {
        let row: any = {
          column1: 'a',
          column2: 1,
          object41s: []
        }

        row.object41s.push(
          {
            object11: row
          },
          {
            object11: row
          }
        )

        let insertedRow = await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let expectedRow: any = {
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null,
          object41s: [
            {
              table1_id1: 1,
              table1_id2: null
            },
            {
              table1_id1: 1,
              table1_id2: null
            }
          ]
        }

        expectedRow.object41s[0].object11 = expectedRow
        expectedRow.object41s[1].object11 = expectedRow

        expect(insertedRow.id).to.equal(1)
        expect(insertedRow).to.deep.equal(expectedRow)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('a')
        expect(table1Rows[0].column2).to.equal(1)

        let tableManyRows = await pgQueryFn('SELECT * FROM table4')

        expect(tableManyRows.length).to.equal(2)
        expect(tableManyRows[0].table1_id1).to.equal(1)
        expect(tableManyRows[0].table1_id2).to.be.null
        expect(tableManyRows[1].table1_id1).to.equal(1)
        expect(tableManyRows[1].table1_id2).to.be.null
      })

      it('should insert a row with a many-to-one relationship', async function() {
        let row: any = {
          column1: 'a',
          object1: {
            column1: 'b',
            column2: 1
          },
          object2: {
            id: 'x',
            column1: 'c'
          }
        }

        row.object1.many = [ row ]
        row.object2.many = [ row ]
        
        let insertedRow = await insert(schema, 'table_many', 'postgres', pgQueryFn, row)

        expect(insertedRow.table1_id).to.equal(1)
        expect(insertedRow.table2_id).to.equal('x')
        expect(insertedRow.column1).to.equal('a')
        expect(insertedRow.object1).to.deep.equal({
          id: 1,
          column1: 'b',
          column2: 1,
          table1_id: null,
          table2_id: null
        })
        expect(insertedRow.object2).to.deep.equal({
          id: 'x',
          column1: 'c'
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('b')
        expect(table1Rows[0].column2).to.equal(1)

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0].id).to.equal('x')
        expect(table2Rows[0].column1).to.equal('c')
      })

      it('should insert a row which many-to-one relationship which refers to an object which is about to be inserted up the recursion chain', async function() {
        let row: any = {
          object5: {}
        }

        row.object5.object5 = row
        
        let insertedRow = await insert(schema, 'table5', 'postgres', pgQueryFn, row)

        let expectedRow = {
          id: 2,
          table5_id: 1,
          object5: {
            id: 1,
            table5_id: 2
          }
        }

        expect(insertedRow).to.deep.equal(expectedRow)

        let table5Rows = await pgQueryFn('SELECT * FROM table5')

        expect(table5Rows.length).to.equal(2)
        expect(table5Rows[0].id).to.equal(2)
        expect(table5Rows[0].table5_id).to.equal(1)
        expect(table5Rows[1].id).to.equal(1)
        expect(table5Rows[1].table5_id).to.equal(2)
      })

      it.only('should insert a row with a one-to-one relationship', async function() {
        let row: any = {
          column1: 'a',
          column2: 1,
          object1: {
            column1: 'b',
            colunm2: 2
          }
        }

        row.object1.object1 = row

        let insertedRow = await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let expectedRow = {
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: 2,
          table2_id: null,
          object1: {
            id: 2,
            column1: 'b',
            column2: 2,
            table1_id: 1,
            table2_id: null
          } as any
        }

        expectedRow.object1.object1 = expectedRow

        expect(insertedRow).to.deep.equal(expectedRow)

        let rows = await pgQueryFn('SELECT * FROM table1')

        expect(rows.length).to.equal(2)
        expect(rows[0].id).to.equal(2)
        expect(rows[0].column1).to.equal('1')
        expect(rows[0].column2).to.equal(1)
        expect(rows[0].table1_id).to.equal(1)
        expect(rows[0].table2_id).to.be.null
        expect(rows[1].id).to.equal(1)
        expect(rows[1].column1).to.equal('b')
        expect(rows[1].column2).to.equal(2)
        expect(rows[1].table1_id).to.equal(1)
        expect(rows[1].table2_id).to.be.null
      })

      it('should insert a row with a many-to-many relationship which also has a many-to-many relationship which references back to the root row', async function() {
        let row: any = {
          many: [{
            object2: {
              id: 'x',
              many: [{}]
            }
          }]
        }

        row.many[0].object2.many[0].object1 = row
        
        let insertedRow = await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let expectedRow = {
          id: 1,
          column1: null,
          column2: null,
          table1_id: null,
          table2_id: null,
          many: [{
            table1_id: 1,
            table2_id: 'x',
            column1: null,
            table1_id2: null,
            object2: {
              id: 'x',
              column1: null,
              many: [{
                table1_id: 1,
                table2_id: 'x',
                column1: null,
                table1_id2: null
              } as any]
            }
          }]
        }

        expectedRow.many[0].object2.many[0].object1 = expectedRow

        expect(insertedRow).to.deep.equal(expectedRow)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')
        expect(table1Rows.length).to.equal(1)

        let tableManyRows = await pgQueryFn('SELECT * FROM table_many')
        expect(tableManyRows.length).to.equal(2)
        expect(tableManyRows[0].table1_id).to.equal(1)
        expect(tableManyRows[0].table2_id).to.equal('x')
        expect(tableManyRows[0].table1_id2).to.be.null
        expect(tableManyRows[1].table1_id).to.equal(1)
        expect(tableManyRows[1].table2_id).to.equal('x')
        expect(tableManyRows[1].table1_id2).to.be.null
      })

      it('should insert a row which many-to-one relationship is part of the id and which is already being inserted up the recursion chain', async function() {
        let row = {
          object2: {
            id: 'x',
            many: [{} as any]
          }
        }

        row.object2.many[0].object1 = row

        let insertedRow = await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let expectedRow = {
          id: 1,
          column1: null,
          column2: null,
          table1_id: null,
          table2_id: 'x',
          object2: {
            id: 'x',
            column1: null,
            many: [{
              table1_id: 1,
              table2_id: 'x',
              column1: null,
              table1_id2: null
            } as any]
          }
        }

        expectedRow.object2.many[0].object1 = expectedRow

        expect(insertedRow).to.deep.equal(expectedRow)
      })

      it('should insert a row which many-to-one relationship is not part of the id and which is already being inserted up the recursion chain', async function() {
        let row = {
          object2: {
            id: 'x',
            many: [{} as any]
          }
        }

        row.object2.many[0].object12 = row

        let insertedRow = await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let expectedRow = {
          id: 1,
          column1: null,
          column2: null,
          table1_id: null,
          table2_id: 'x',
          object2: {
            id: 'x',
            column1: null,
            many: [{
              table1_id: null,
              table2_id: 'x',
              column1: null,
              table1_id2: 1
            }]
          }
        }

        expect(insertedRow).to.deep.equal(expectedRow)
      })

      it('should not insert the same object twice inside many-to-one', async function() {
        let table1Row = {
          column1: 'a',
          column2: 1
        }

        let row = {
          object11: table1Row,
          object12: table1Row
        }

        let insertedRow = await insert(schema, 'table4', 'postgres', pgQueryFn, row)

        expect(insertedRow.table1_id1).to.equal(1)
        expect(insertedRow.table1_id2).to.equal(1)
        expect(insertedRow.object11).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null
        })
        expect(insertedRow.object12).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null
        })
        expect(insertedRow.object11 === insertedRow.object12).to.be.true

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('a')
        expect(table1Rows[0].column2).to.equal(1)
      })

      it('should not insert the same object twice when it is inside one-to-many', async function() {
        let tableManyRow = {
          column1: 'a'
        }

        let row = {
          many: [ tableManyRow, tableManyRow, tableManyRow ]
        }

        let insertedRow = await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow.id).to.equal(1)
        expect(insertedRow.many).to.deep.equal([{
          table1_id: 1,
          table2_id: null,
          column1: 'a',
          table1_id2: null,
        }])

        let table1Rows = await pgQueryFn('SELECT * FROM table_many')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].table1_id).to.equal(1)
        expect(table1Rows[0].table2_id).to.be.null
        expect(table1Rows[0].column1).to.equal('a')
      })
    })

    describe('select', function() {
      it('should select the one row where the many-to-one relationship is present', async function() {
        let row = {
          column1: 'a',
          column2: 1,
          many: [
            {
              column1: 'b',
              object2: {
                id: 'x',
                column1: 'c'
              }
            },
            {
              column1: 'd'
            }
          ]
        }

        await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let criteria = {
          id: 1,
          column1: 'a',
          many: {
            column1: 'b',
            object2: {
              column1: 'c'
            }
          }
        }  

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, criteria)

        expect(rows.length).to.equal(1)
        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null,
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
            }
          ]
        })
      })

      it('should select the one row where the many-to-one relationship is not present', async function() {
        let row = {
          column1: 'a',
          column2: 1,
          many: [
            {
              column1: 'b',
              object2: {
                id: 'x',
                column1: 'c'
              }
            },
            {
              column1: 'd'
            }
          ]
        }

        await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let criteria = {
          id: 1,
          column1: 'a',
          many: {
            column1: 'd',
            object2: {}
          }
        }  

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, criteria)

        expect(rows.length).to.equal(1)
        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null,
          many: [
            {
              table1_id: 1,
              table2_id: null,
              column1: 'd',
              table1_id2: null
            }
          ]
        })
      })

      it('should select all rows', async function() {
        let row = {
          column1: 'a',
          column2: 1,
          many: [
            {
              column1: 'b',
              object2: {
                id: 'x',
                column1: 'c'
              }
            },
            {
              column1: 'd'
            }
          ]
        }

        await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let criteria = { many: { object2: {} }}

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, criteria)

        expect(rows.length).to.equal(2)
        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null,
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
            },
            {
              table1_id: 1,
              table2_id: null,
              column1: 'd',
              table1_id2: null
            }
          ]
        })
      })

      it('should select a row which columns are null', function() {

      })

      it('should select one-to-many row which columns are all null', function() {

      })

      it('should select a many-to-ony relationship which columns are all null', function() {

      })
    })

    describe('delete_', function() {
      it('should delete a simple row by id', async function() {
        await insert(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', column2: 1 })
        await insert(schema, 'table1', 'postgres', pgQueryFn, { column1: 'b', column2: 2 })

        let deletedRows = await delete_(schema, 'table1', 'postgres', pgQueryFn, { id: 1 })

        expect(deletedRows).to.deep.equal([{
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null
        }])

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows).to.deep.equal([{
          id: 2,
          column1: 'b',
          column2: 2,
          table1_id: null,
          table2_id: null
        }])
      })

      it('should delete a simple row by another column than the id', async function() {
        await insert(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', column2: 1 })
        await insert(schema, 'table1', 'postgres', pgQueryFn, { column1: 'b', column2: 2 })

        let deletedRows = await delete_(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a' })

        expect(deletedRows).to.deep.equal([{
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null
        }])

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows).to.deep.equal([{
          id: 2,
          column1: 'b',
          column2: 2,
          table1_id: null,
          table2_id: null
        }])
      })

      it('should not delete anything if the criteria contained invalid columns', async function() {
        await insert(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', column2: 1 })
        await insert(schema, 'table1', 'postgres', pgQueryFn, { column1: 'b', column2: 2 })

        expect(delete_(schema, 'table1', 'postgres', pgQueryFn, { invalid: 'invalid' })).to.be.rejectedWith(Error)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(2)
        expect(table1Rows).to.deep.equal([
          {
            id: 1,
            column1: 'a',
            column2: 1,
            table1_id: null,
            table2_id: null  
          },
          {
            id: 2,
            column1: 'b',
            column2: 2,
            table1_id: null,
            table2_id: null  
          }
        ])
      })

      it('should delete its one-to-many relationships', async function() {
        let row1 = {
          column1: 'a',
          column2: 1,
          many: [
            {
              column1: 'b',
              object2: {
                id: 'x',
                column1: 'c'
              }
            }
          ]
        }

        let row2 = {
          column1: 'b',
          column2: 2,
          many: [
            {
              column1: 'c',
              object2: {
                id: 'y',
                column1: 'd'
              }
            }
          ]
        }

        await insert(schema, 'table1', 'postgres', pgQueryFn, row1)
        await insert(schema, 'table1', 'postgres', pgQueryFn, row2)

        let deletedRows = await delete_(schema, 'table1', 'postgres', pgQueryFn, { id: 1 })

        expect(deletedRows.length).to.equal(1)
        expect(deletedRows).to.deep.equal([{
          id: 1,
          column1: 'a',
          column2: 1,
          table1_id: null,
          table2_id: null,
          many: [
            {
              table1_id: 1,
              table2_id: 'x',
              column1: 'b',
              table1_id2: null
            }
          ]
        }])

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(2)
        expect(table1Rows[0].column1).to.equal('b')
        expect(table1Rows[0].column2).to.equal(2)

        let tableManyRows = await pgQueryFn('SELECT * FROM table_many')

        expect(tableManyRows.length).to.equal(1)
        expect(tableManyRows[0].table1_id).to.equal(2)
        expect(tableManyRows[0].table2_id).to.equal('y')
        expect(tableManyRows[0].column1).to.equal('c')
        expect(tableManyRows[0].table1_id2).to.be.null

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(2)
        expect(table2Rows[0].id).to.equal('x')
        expect(table2Rows[0].column1).to.equal('c')
        expect(table2Rows[1].id).to.equal('y')
        expect(table2Rows[1].column1).to.equal('d')
      })

      it('should delete its one-to-one relationship', async function() {
        let row1 = {
          column1: 'a',
          object3: {
            column1: 'b'
          }
        }

        let row2 = {
          column1: 'c',
          object3: {
            column1: 'd',
          }
        }

        await insert(schema, 'table3', 'postgres', pgQueryFn, row1)
        await insert(schema, 'table3', 'postgres', pgQueryFn, row2)

        let deletedRows = await delete_(schema, 'table3', 'postgres', pgQueryFn, { id: 1 })

        expect(deletedRows.length).to.equal(1)
        expect(deletedRows).to.deep.equal([{
          id: 1,
          column1: 'a',
          table3_id: 2,
          object3: {
            id: 2,
            column1: 'b',
            table3_id: 1
          }
        }])

        let table3Rows = await pgQueryFn('SELECT * FROM table3')

        expect(table3Rows.length).to.equal(2)
        expect(table3Rows[0].id).to.equal(4)
        expect(table3Rows[0].column1).to.equal('d')
        expect(table3Rows[1].id).to.equal(3)
        expect(table3Rows[1].column1).to.equal('c')
      })
    })
  })
})

async function pgQueryFn(sqlString: string, values?: any[]): Promise<any[]> {
  let result = await pool.query(sqlString, values)
  return result.rows
}