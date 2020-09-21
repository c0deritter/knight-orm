import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { insert, select, update } from '../src/isud'
import { schema } from './testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

let pool: Pool = new Pool({
  host: 'postgres',
  database: 'sqlorm_test',
  user: 'sqlorm_test',
  password: 'sqlorm_test'
} as PoolConfig)

describe('isud', function() {
  describe('PostgreSQL', function () {
    after(async function() {
      await pool.end()
    })

    beforeEach(async function() {
      await pool.query('CREATE TABLE table1 (id SERIAL, column1 VARCHAR(20), column2 INTEGER)')
      await pool.query('CREATE TABLE table2 (id VARCHAR(20), column1 VARCHAR(20))')
      await pool.query('CREATE TABLE table3 (id SERIAL, column1 VARCHAR(20), table3_id INTEGER)')
      await pool.query('CREATE TABLE table4 (table1_id1 INTEGER, table1_id2 INTEGER)')
      await pool.query('CREATE TABLE table_many (table1_id INTEGER, table2_id VARCHAR(20), column1 VARCHAR(20), table1_id2 INTEGER)')
    })

    afterEach(async function() {
      await pool.query('DROP TABLE IF EXISTS table1 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table2 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table3 CASCADE')
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

        expect(insertedRow.id).to.equal(1)
        expect(insertedRow.column1).to.equal('a')
        expect(insertedRow.column2).to.equal(1)
        expect(insertedRow.many).to.deep.equal([
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
            table2_id: 'y',
            column1: 'd',
            table1_id2: null,
            object2: {
              id: 'y',
              column1: 'e'
            }
          }
        ])

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
          column2: 1
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

      it('should insert a row with a one-to-one relationship', async function() {
        let row: any = {
          column1: 'a',
          object3: {
            column1: 'b'
          }
        }

        row.object3.object3 = row

        let insertedRow = await insert(schema, 'table3', 'postgres', pgQueryFn, row)

        expect(insertedRow.id).to.equal(2)
        expect(insertedRow.table3_id).to.equal(1)
        expect(insertedRow.column1).to.equal('a')
        expect(insertedRow.object3).to.deep.equal({
          id: 1,
          column1: 'b',
          table3_id: 2
        })

        let rows = await pgQueryFn('SELECT * FROM table3')

        expect(rows.length).to.equal(2)
        expect(rows[0].id).to.equal(2)
        expect(rows[0].table3_id).to.equal(1)
        expect(rows[0].column1).to.equal('a')
        expect(rows[1].id).to.equal(1)
        expect(rows[1].table3_id).to.equal(2)
        expect(rows[1].column1).to.equal('b')
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
          column2: 1
        })
        expect(insertedRow.object12).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: 1
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
    })

    describe('update', function() {
      it('should update a simple row without relationships', async function() {
        let row = {
          column1: 'a',
          column2: 1
        }

        await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let updateRow = {
          id: 1,
          column1: 'b',
          column2: 2
        }

        let updatedRow = await update(schema, 'table1', 'postgres', pgQueryFn, updateRow)

        expect(updatedRow.id).to.equal(1)
        expect(updatedRow.column1).to.equal('b')
        expect(updatedRow.column2).to.equal(2)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('b')
        expect(table1Rows[0].column2).to.equal(2)
      })

      it('should not update if the id is missing', async function() {
        let row = {
          column1: 'a',
          column2: 1
        }

        await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let updateRow = {
          column1: 'b',
          column2: 2
        }

        expect(update(schema, 'table1', 'postgres', pgQueryFn, updateRow)).to.be.rejectedWith(Error)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('a')
        expect(table1Rows[0].column2).to.equal(1)
      })

      it('should not update if there was no valid column to set', async function() {
        let row = {
          column1: 'a',
          column2: 1
        }

        await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let updateRow = {
          id: 1,
          invalidColumn: 'error'
        }

        let updatedRow = await update(schema, 'table1', 'postgres', pgQueryFn, updateRow)

        expect(updatedRow).to.be.not.undefined
        expect(updatedRow.id).to.equal(1)
        expect(updatedRow.column1).to.equal('a')
        expect(updatedRow.column2).to.equal(1)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('a')
        expect(table1Rows[0].column2).to.equal(1)
      })

      it('should update a row with relationships', async function() {
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
            }
          ]
        }

        await insert(schema, 'table1', 'postgres', pgQueryFn, row)

        let updateRow = {
          id: 1,
          column1: 'b',
          column2: 2,
          many: [
            {
              table1_id: 1,
              table2_id: 'x',
              column1: 'c',
              object2: {
                id: 'x',
                column1: 'd'
              }
            }
          ]
        }

        let updatedRow = await update(schema, 'table1', 'postgres', pgQueryFn, updateRow)

        expect(updatedRow.id).to.equal(1)
        expect(updatedRow.column1).to.equal('b')
        expect(updatedRow.column2).to.equal(2)
        expect(updatedRow.many).to.deep.equal([
          {
            table1_id: 1,
            table2_id: 'x',
            column1: 'c',
            table1_id2: null,
            object2: {
              id: 'x',
              column1: 'd'
            }
          }
        ])

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('b')
        expect(table1Rows[0].column2).to.equal(2)

        let tableManyRows = await pgQueryFn('SELECT * FROM table_many')

        expect(tableManyRows.length).to.equal(1)
        expect(tableManyRows[0].table1_id).to.equal(1)
        expect(tableManyRows[0].table2_id).to.equal('x')
        expect(tableManyRows[0].column1).to.equal('c')
        expect(tableManyRows[0].table1_id2).to.be.null

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0].id).to.equal('x')
        expect(table2Rows[0].column1).to.equal('d')
      })

      it('should update the same row object only once', async function() {
        let table1Row = {
          column1: 'a',
          column2: 1
        }

        let row = {
          object11: table1Row,
          object12: table1Row
        }

        await insert(schema, 'table4', 'postgres', pgQueryFn, row)

        let updateTable1Row = {
          id: 1,
          column1: 'b',
          column2: 2
        }

        let updateRow = {
          table1_id1: 1,
          table1_id2: 1,
          object11: updateTable1Row,
          object12: updateTable1Row
        }

        let updatedRow = await update(schema, 'table4', 'postgres', pgQueryFn, updateRow)

        expect(updatedRow).to.be.not.undefined
        expect(updatedRow.table1_id1).to.equal(1)
        expect(updatedRow.table1_id2).to.equal(1)
        expect(updatedRow.object11).to.deep.equal({
          id: 1,
          column1: 'b',
          column2: 2
        })
        expect(updatedRow.object12).to.deep.equal({
          id: 1,
          column1: 'b',
          column2: 2
        })
        expect(updatedRow.object11 === updatedRow.object12).to.be.true

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('b')
        expect(table1Rows[0].column2).to.equal(2)

        let table2Rows = await pgQueryFn('SELECT * FROM table4')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0].table1_id1).to.equal(1)
        expect(table2Rows[0].table1_id2).to.equal(1)
      })
    })
  })
})

async function pgQueryFn(sqlString: string, values?: any[]): Promise<any[]> {
  let result = await pool.query(sqlString, values)
  return result.rows
}