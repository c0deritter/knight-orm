import { expect } from 'chai'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { databaseIndependentQuery } from '../src/query'

let pool: Pool = new Pool({
  host: 'postgres',
  database: 'sqlorm_test',
  user: 'sqlorm_test',
  password: 'sqlorm_test'
} as PoolConfig)

function pgQueryFn(sqlString: string, values?: any[]): Promise<any> {
  return pool.query(sqlString, values)
}

describe('query', function() {
  after(async function() {
    await pool.end()
  })

  beforeEach(async function() {
    await pool.query('CREATE TABLE table1 (id SERIAL, column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP, many_to_one_object1_id INTEGER, many_to_one_object2_id VARCHAR(20), one_to_one_object1_id INTEGER, one_to_one_object2_id VARCHAR(20), one_to_many_object1_many_to_one_id INTEGER)')
    await pool.query('CREATE TABLE table2 (id VARCHAR(20), column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP, one_to_one_object1_id INTEGER, one_to_many_object2_many_to_one_id INTEGER)')
    await pool.query('CREATE TABLE many_to_many_table1 (table1_id1 INTEGER, table1_id2 INTEGER, column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP)')
    await pool.query('CREATE TABLE many_to_many_table2 (table1_id INTEGER, table2_id VARCHAR(20), column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP)')
  })

  afterEach(async function() {
    await pool.query('DROP TABLE IF EXISTS table1 CASCADE')
    await pool.query('DROP TABLE IF EXISTS table2 CASCADE')
    await pool.query('DROP TABLE IF EXISTS many_to_many_table1 CASCADE')
    await pool.query('DROP TABLE IF EXISTS many_to_many_table2 CASCADE')
  })

  describe('databaseIndependentQuery', function() {
    describe('PostgreSQL', function() {
      it('should select all rows', async function() {
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')

        let result = await databaseIndependentQuery('postgres', pgQueryFn, 'SELECT * FROM table1 ORDER BY id')

        expect(result).to.deep.equal([
          {
            id: 1,
            column1: null,
            column2: null,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
          },
          {
            id: 2,
            column1: null,
            column2: null,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
          },
          {
            id: 3,
            column1: null,
            column2: null,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
          }
        ])
      })

      it('should insert a row', async function() {
        let result = await databaseIndependentQuery('postgres', pgQueryFn, 'INSERT INTO table2 (id, column1) VALUES ($1, $2)', ['x', 'a'])

        expect(result).to.deep.equal({
          affectedRows: 1
        })
      })

      it('should insert a row and return the generated id', async function() {
        let result = await databaseIndependentQuery('postgres', pgQueryFn, 'INSERT INTO table1 (column1) VALUES ($1)', ['a'], 'id')

        expect(result).to.deep.equal({
          affectedRows: 1,
          insertId: 1
        })
      })

      it('should update rows', async function() {
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')

        let result = await databaseIndependentQuery('postgres', pgQueryFn, 'UPDATE table1 SET column1=$1', ['a'])

        expect(result).to.deep.equal({
          affectedRows: 3
        })
      })

      it('should delete rows', async function() {
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')

        let result = await databaseIndependentQuery('postgres', pgQueryFn, 'DELETE FROM table1')

        expect(result).to.deep.equal({
          affectedRows: 3
        })
      })
    })
  })
})
