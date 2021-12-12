import { expect } from 'chai'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { isUpdate, objectsRepresentSameEntity } from '../src'
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

  describe('isUpdate', function() {
    it('should return false if the generated primary key is not set', async function() {
      let row = {
      }

      let result = await isUpdate(schema.getTable('table1'), 'postgres', pgQueryFn, row, true)

      expect(result).to.be.false
    })

    it('should return true if the generated primary key is already set', async function() {
      let row = {
        id: 1
      }

      let result = await isUpdate(schema.getTable('table1'), 'postgres', pgQueryFn, row, true)

      expect(result).to.be.true
    })

    it('should return false if a row with the not generated primary does not exist', async function() {
      let row = {
        id: 'x'
      }

      let result = await isUpdate(schema.getTable('table2'), 'postgres', pgQueryFn, row, true)

      expect(result).to.be.false
    })

    it('should return true if a row with the not generated primary does already exist', async function() {
      await pgQueryFn('INSERT INTO table2 (id) VALUES (\'x\')')

      let row = {
        id: 'x'
      }

      let result = await isUpdate(schema.getTable('table2'), 'postgres', pgQueryFn, row, true)

      expect(result).to.be.true
    })

    it('should return false if a row with the composite primary key does not exist', async function() {
      let row = {
        table1_id: 1,
        table2_id: 'x'
      }

      let result = await isUpdate(schema.getTable('many_to_many_table2'), 'postgres', pgQueryFn, row, true)

      expect(result).to.be.false
    })

    it('should return true if a row with the composite primary key does already exist', async function() {
      await pgQueryFn('INSERT INTO many_to_many_table2 (table1_id, table2_id) VALUES (1, \'x\')')

      let row = {
        table1_id: 1,
        table2_id: 'x'
      }

      let result = await isUpdate(schema.getTable('many_to_many_table2'), 'postgres', pgQueryFn, row, true)

      expect(result).to.be.true
    })
  })

  describe('objectsRepresentSameEntity', function() {
    it('should detect two rows as the same entity', function() {
      let row1 = { id: 1, column1: 'a', column2: 1 }
      let row2 = { id: 1, column1: 'b', column2: 2 }

      expect(objectsRepresentSameEntity(schema.getTable('table1'), row1, row2, true)).to.be.true
      expect(objectsRepresentSameEntity(schema.getTable('table1'), row2, row1, true)).to.be.true

      let row3 = { table1_id: 1, table2_id: 'x', column1: 'a' }
      let row4 = { table1_id: 1, table2_id: 'x', column1: 'b' }

      expect(objectsRepresentSameEntity(schema.getTable('many_to_many_table2'), row3, row4, true)).to.be.true
      expect(objectsRepresentSameEntity(schema.getTable('many_to_many_table2'), row3, row4, true)).to.be.true
    })

    it('should not detect two rows as the same entity', function() {
      let row1 = { id: 1 }
      let row2 = { id: 2, column1: 'a', column2: 1 }

      expect(objectsRepresentSameEntity(schema.getTable('table1'), row1, row2, true)).to.be.false
      expect(objectsRepresentSameEntity(schema.getTable('table1'), row2, row1, true)).to.be.false

      let row3 = { table1_id: 1, table2_id: 'x' }
      let row4 = { table1_id: 2, table2_id: 'x', column1: 'a' }

      expect(objectsRepresentSameEntity(schema.getTable('many_to_many_table2'), row3, row4, true)).to.be.false
      expect(objectsRepresentSameEntity(schema.getTable('many_to_many_table2'), row3, row4, true)).to.be.false
    })
  })
})
