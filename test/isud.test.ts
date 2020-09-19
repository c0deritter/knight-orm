import { expect } from 'chai'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { rowToDeleteCriteria } from '../src/criteriaTools'
import { insert } from '../src/isud'
import { schema } from './testSchema'

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
      await pool.query('CREATE TABLE table_many (table1_id INTEGER, table2_id VARCHAR(20), column1 VARCHAR(20))')
    })

    afterEach(async function() {
      await pool.query('DROP TABLE IF EXISTS table1 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table2 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table3 CASCADE')
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

        let talbe1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(talbe1Rows.length).to.equal(1)
        expect(talbe1Rows[0].id).to.equal(1)
        expect(talbe1Rows[0].column1).to.equal('a')
        expect(talbe1Rows[0].column2).to.equal(1)

        let talbeManyRows = await pgQueryFn('SELECT * FROM table_many')

        expect(talbeManyRows.length).to.equal(2)
        expect(talbeManyRows[0].table1_id).to.equal(1)
        expect(talbeManyRows[0].table2_id).to.equal('x')
        expect(talbeManyRows[0].column1).to.equal('b')
        expect(talbeManyRows[1].table1_id).to.equal(1)
        expect(talbeManyRows[1].table2_id).to.equal('y')
        expect(talbeManyRows[1].column1).to.equal('d')

        let talbe2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(talbe2Rows.length).to.equal(2)
        expect(talbe2Rows[0].id).to.equal('x')
        expect(talbe2Rows[0].column1).to.equal('c')
        expect(talbe2Rows[1].id).to.equal('y')
        expect(talbe2Rows[1].column1).to.equal('e')
      })

      it.only('should insert a row with a many-to-many relationship', async function() {
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

        let talbe1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(talbe1Rows.length).to.equal(1)
        expect(talbe1Rows[0].id).to.equal(1)
        expect(talbe1Rows[0].column1).to.equal('b')
        expect(talbe1Rows[0].column2).to.equal(1)

        let talbe2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(talbe2Rows.length).to.equal(1)
        expect(talbe2Rows[0].id).to.equal('x')
        expect(talbe2Rows[0].column1).to.equal('c')
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

        let talbe1Rows = await pgQueryFn('SELECT * FROM table3')

        expect(talbe1Rows.length).to.equal(2)
        expect(talbe1Rows[0].id).to.equal(2)
        expect(talbe1Rows[0].table3_id).to.equal(1)
        expect(talbe1Rows[0].column1).to.equal('a')
        expect(talbe1Rows[1].id).to.equal(1)
        expect(talbe1Rows[1].table3_id).to.equal(2)
        expect(talbe1Rows[1].column1).to.equal('b')
      })
    })
  })
})

async function pgQueryFn(sqlString: string, values?: any[]): Promise<any[]> {
  let result = await pool.query(sqlString, values)
  return result.rows
}