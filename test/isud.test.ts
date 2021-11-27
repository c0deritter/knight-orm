import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { delete_, store, select, isUpdate } from '../src/isud'
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
      await pool.query('CREATE TABLE table1 (id SERIAL, column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP, many_to_one_id VARCHAR(20), many_to_one_recursive_id INTEGER, one_to_one_id VARCHAR(20), one_to_one_recursive_id INTEGER, one_to_many_recursive_id INTEGER)')
      await pool.query('CREATE TABLE table2 (id VARCHAR(20), column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP, one_to_one_id INTEGER, one_to_many_id INTEGER)')
      await pool.query('CREATE TABLE many_to_many (table1_id INTEGER, table2_id VARCHAR(20), column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP)')
      await pool.query('CREATE TABLE many_to_many_recursive (table11_id INTEGER, table12_id INTEGER, column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP)')
    })

    afterEach(async function() {
      await pool.query('DROP TABLE IF EXISTS table1 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table2 CASCADE')
      await pool.query('DROP TABLE IF EXISTS many_to_many CASCADE')
      await pool.query('DROP TABLE IF EXISTS many_to_many_recursive CASCADE')
    })
    
    describe('isUpdate', function() {
      it('should return false if the generated primary key is not set', async function() {
        let row = {
        }

        let result = await isUpdate(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(result).to.be.false
      })

      it('should return true if the generated primary key is already set', async function() {
        let row = {
          id: 1
        }

        let result = await isUpdate(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(result).to.be.true
      })

      it('should return false if a row with the not generated primary does not exist', async function() {
        let row = {
          id: 'x'
        }

        let result = await isUpdate(schema, 'table2', 'postgres', pgQueryFn, row)

        expect(result).to.be.false
      })

      it('should return true if a row with the not generated primary does already exist', async function() {
        await pgQueryFn('INSERT INTO table2 (id) VALUES (\'x\')')

        let row = {
          id: 'x'
        }

        let result = await isUpdate(schema, 'table2', 'postgres', pgQueryFn, row)

        expect(result).to.be.true
      })

      it('should return false if a row with the composite primary key does not exist', async function() {
        let row = {
          table1_id: 1,
          table2_id: 'x'
        }

        let result = await isUpdate(schema, 'many_to_many', 'postgres', pgQueryFn, row)

        expect(result).to.be.false
      })

      it('should return true if a row with the composite primary key does already exist', async function() {
        await pgQueryFn('INSERT INTO many_to_many (table1_id, table2_id) VALUES (1, \'x\')')

        let row = {
          table1_id: 1,
          table2_id: 'x'
        }

        let result = await isUpdate(schema, 'many_to_many', 'postgres', pgQueryFn, row)

        expect(result).to.be.true
      })
    })
    
    describe('store', function() {
      it('should insert a simple row', async function() {
        let row = {
          column1: 'a'
        }
  
        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)
  
        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let rows = await pgQueryFn('SELECT * FROM table1')

        expect(rows.length).to.equal(1)
        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
        })
      })

      it('should insert a many-to-one relationship which primary key is not generated', async function() {
        let row = {
          column1: 'a',
          manyToOne: {
            id: 'x',
            column1: 'b'
          }
        }

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: 'x',
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToOne: {
            id: 'x',
            column1: 'b',
            column2: null,
            column3: null,
            one_to_one_id: null,
            one_to_many_id: null
          }
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: 'x',
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
        })

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: null
        })
      })

      it('should insert a many-to-one relationship which primary key is generated', async function() {
        let row = {
          column1: 'a',
          manyToOneRecursive: {
            column1: 'b'
          }
        }

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 2,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToOneRecursive: {
            id: 2,
            column1: 'b',
            column2: null,
            column3: null,
            many_to_one_id: null,
            many_to_one_recursive_id: null,
            one_to_one_id: null,
            one_to_one_recursive_id: null,
            one_to_many_recursive_id: null,
            }
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(2)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 2,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(table1Rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })
      })

      it('should insert a one-to-one relationship', async function() {
        let row = {
          column1: 'a',
          oneToOne: {
            id: 'x',
            column1: 'b'
          }
        }

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: 'x',
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          oneToOne: {
            id: 'x',
            column1: 'b',
            column2: null,
            column3: null,
            one_to_one_id: 1,
            one_to_many_id: null
          }
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: 'x',
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_id: 1,
          one_to_many_id: null
        })
      })

      it('should insert a one-to-one relationship which also references back to the source row object', async function() {
        let row = {
          column1: 'a',
          oneToOne: {
            id: 'x',
            column1: 'b',
            oneToOne: {}
          }
        }

        row.oneToOne.oneToOne = row

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: 'x',
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          oneToOne: {
            id: 'x',
            column1: 'b',
            column2: null,
            column3: null,
            one_to_one_id: 1,
            one_to_many_id: null,
            oneToOne: {}
          }
        }

        expected.oneToOne.oneToOne = expected

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: 'x',
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_id: 1,
          one_to_many_id: null
        })
      })

      it('should insert a one-to-one relationship which references the same table', async function() {
        let row = {
          column1: 'a',
          oneToOneRecursive: {
            column1: 'b'
          }
        }

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: 2,
          one_to_many_recursive_id: null,
          oneToOneRecursive: {
            id: 2,
            column1: 'b',
            column2: null,
            column3: null,
            many_to_one_id: null,
            many_to_one_recursive_id: null,
            one_to_one_id: null,
            one_to_one_recursive_id: 1,
            one_to_many_recursive_id: null
            }
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(2)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: 2,
          one_to_many_recursive_id: null
        })

        expect(table1Rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: 1,
          one_to_many_recursive_id: null
        })
      })

      it('should insert a one-to-one relationship which references the same table and which also references back to the source row object', async function() {
        let row = {
          column1: 'a',
          oneToOneRecursive: {
            column1: 'b',
            oneToOneRecursive: {}
          }
        }

        row.oneToOneRecursive.oneToOneRecursive = row

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: 2,
          one_to_many_recursive_id: null,
          oneToOneRecursive: {
            id: 2,
            column1: 'b',
            column2: null,
            column3: null,
            many_to_one_id: null,
            many_to_one_recursive_id: null,
            one_to_one_id: null,
            one_to_one_recursive_id: 1,
            one_to_many_recursive_id: null,
            oneToOneRecursive: {}
          }
        }

        expected.oneToOneRecursive.oneToOneRecursive = expected

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(2)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: 2,
          one_to_many_recursive_id: null
        })

        expect(table1Rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: 1,
          one_to_many_recursive_id: null
        })
      })

      it('should insert a one-to-one relationship which references the same entity', async function() {
        let row = {
          column1: 'a',
          oneToOneRecursive: {}
        }

        row.oneToOneRecursive = row

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)
        
        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: 1,
          one_to_many_recursive_id: null,
          oneToOneRecursive: {}
        }

        expected.oneToOneRecursive = expected

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: 1,
          one_to_many_recursive_id: null
        })
      })

      it('should insert a one-to-many relationship', async function() {
        let row = {
          column1: 'a',
          oneToMany: [
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

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.not.be.undefined
        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          oneToMany: [
            {
              id: 'x',
              column1: 'b',
              column2: null,
              column3: null,
              one_to_one_id: null,
              one_to_many_id: 1
            },
            {
              id: 'y',
              column1: 'c',
              column2: null,
              column3: null,
              one_to_one_id: null,
              one_to_many_id: 1
            }
          ]
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(2)
        
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: 1
        })

        expect(table2Rows[1]).to.deep.equal({
          id: 'y',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: 1
        })
      })

      it('should insert a one-to-many relationship which also references back to the source row object', async function() {
        let row = {
          column1: 'a',
          oneToMany: [
            {
              id: 'x',
              column1: 'b',
              oneToManyOne: {}
            },
            {
              id: 'y',
              column1: 'c',
              oneToManyOne: {}
            }
          ]
        }

        row.oneToMany[0].oneToManyOne = row
        row.oneToMany[1].oneToManyOne = row

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          oneToMany: [
            {
              id: 'x',
              column1: 'b',
              column2: null,
              column3: null,
              one_to_one_id: null,
              one_to_many_id: 1,
              oneToManyOne: {}
            },
            {
              id: 'y',
              column1: 'c',
              column2: null,
              column3: null,
              one_to_one_id: null,
              one_to_many_id: 1,
              oneToManyOne: {}
            }
          ]
        }

        expected.oneToMany[0].oneToManyOne = expected
        expected.oneToMany[1].oneToManyOne = expected

        expect(insertedRow).to.not.be.undefined
        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(2)
        
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: 1
        })

        expect(table2Rows[1]).to.deep.equal({
          id: 'y',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: 1
        })
      })

      it('should insert a one-to-many relationship which references the same table', async function() {
        let row = {
          column1: 'a',
          oneToManyRecursive: [
            {
              column1: 'b'
            },
            {
              column1: 'c'
            }
          ]
        }

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.not.be.undefined
        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          oneToManyRecursive: [
            {
              id: 2,
              column1: 'b',
              column2: null,
              column3: null,
              many_to_one_id: null,
              many_to_one_recursive_id: null,
              one_to_one_id: null,
              one_to_one_recursive_id: null,
              one_to_many_recursive_id: 1
            },
            {
              id: 3,
              column1: 'c',
              column2: null,
              column3: null,
              many_to_one_id: null,
              many_to_one_recursive_id: null,
              one_to_one_id: null,
              one_to_one_recursive_id: null,
              one_to_many_recursive_id: 1
            }
          ]
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(3)

        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(table1Rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: 1
        })

        expect(table1Rows[2]).to.deep.equal({
          id: 3,
          column1: 'c',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: 1
        })
      })

      it('should insert a one-to-many relationship which references the same table and which also references back to the source row object', async function() {
        let row = {
          column1: 'a',
          oneToManyRecursive: [
            {
              column1: 'b',
              oneToManyRecursiveOne: {}
            },
            {
              column1: 'c',
              oneToManyRecursiveOne: {}
            }
          ]
        }

        row.oneToManyRecursive[0].oneToManyRecursiveOne = row
        row.oneToManyRecursive[1].oneToManyRecursiveOne = row
        
        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          oneToManyRecursive: [
            {
              id: 2,
              column1: 'b',
              column2: null,
              column3: null,
              many_to_one_id: null,
              many_to_one_recursive_id: null,
              one_to_one_id: null,
              one_to_one_recursive_id: null,
              one_to_many_recursive_id: 1,
              oneToManyRecursiveOne: {}
            },
            {
              id: 3,
              column1: 'c',
              column2: null,
              column3: null,
              many_to_one_id: null,
              many_to_one_recursive_id: null,
              one_to_one_id: null,
              one_to_one_recursive_id: null,
              one_to_many_recursive_id: 1,
              oneToManyRecursiveOne: {}
            }
          ]
        }

        expected.oneToManyRecursive[0].oneToManyRecursiveOne = expected
        expected.oneToManyRecursive[1].oneToManyRecursiveOne = expected
        
        expect(insertedRow).to.not.be.undefined
        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(3)

        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(table1Rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: 1
        })

        expect(table1Rows[2]).to.deep.equal({
          id: 3,
          column1: 'c',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: 1
        })
      })

      it('should insert a many-to-many relationship', async function() {
        let row = {
          column1: 'a',
          manyToMany: [
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

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToMany: [
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
                one_to_one_id: null,
                one_to_many_id: null      
              }
            },
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
                one_to_one_id: null,
                one_to_many_id: null
              }
            }
          ]
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let tableManyRows = await pgQueryFn('SELECT * FROM many_to_many ORDER BY table1_id')

        expect(tableManyRows.length).to.equal(2)

        expect(tableManyRows[0]).to.deep.equal({
          table1_id: 1,
          table2_id: 'x',
          column1: 'b',
          column2: null,
          column3: null
        })

        expect(tableManyRows[1]).to.deep.equal({
          table1_id: 1,
          table2_id: 'y',
          column1: 'd',
          column2: null,
          column3: null
        })

        let table2Rows = await pgQueryFn('SELECT * FROM table2 ORDER BY id')

        expect(table2Rows.length).to.equal(2)
        
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: null
        })

        expect(table2Rows[1]).to.deep.equal({
          id: 'y',
          column1: 'e',
          column2: null,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: null
        })
      })

      it('should insert a many-to-many relationship which also references back to the source row object', async function() {
        let row = {
          column1: 'a',
          manyToMany: [
            {
              column1: 'b',
              object1: {},
              object2: {
                id: 'x',
                column1: 'c',
                manyToMany: []
              } as any
            },
            {
              column1: 'd',
              object1: {},
              object2: {
                id: 'y',
                column1: 'e',
                manyToMany: []
              }
            }
          ]
        }

        row.manyToMany[0].object1 = row
        row.manyToMany[0].object2.manyToMany.push(row.manyToMany[0])
        row.manyToMany[1].object1 = row
        row.manyToMany[1].object2.manyToMany.push(row.manyToMany[1])

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToMany: [
            {
              table1_id: 1,
              table2_id: 'x',
              column1: 'b',
              column2: null,
              column3: null,
              object1: {},
              object2: {
                id: 'x',
                column1: 'c',
                column2: null,
                column3: null,
                one_to_one_id: null,
                one_to_many_id: null,
                // manyToMany: []
              } as any
            },
            {
              table1_id: 1,
              table2_id: 'y',
              column1: 'd',
              column2: null,
              column3: null,
              object1: {},
              object2: {
                id: 'y',
                column1: 'e',
                column2: null,
                column3: null,
                one_to_one_id: null,
                one_to_many_id: null,
                // manyToMany: []
              }
            }
          ]
        }

        expected.manyToMany[0].object1 = expected
        // expected.manyToMany[0].object2.manyToMany.push(expected.manyToMany[0])
        expected.manyToMany[1].object1 = expected
        // expected.manyToMany[1].object2.manyToMany.push(expected.manyToMany[1])

        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let tableManyRows = await pgQueryFn('SELECT * FROM many_to_many ORDER BY table1_id')

        expect(tableManyRows.length).to.equal(2)

        expect(tableManyRows[0]).to.deep.equal({
          table1_id: 1,
          table2_id: 'x',
          column1: 'b',
          column2: null,
          column3: null
        })

        expect(tableManyRows[1]).to.deep.equal({
          table1_id: 1,
          table2_id: 'y',
          column1: 'd',
          column2: null,
          column3: null
        })

        let table2Rows = await pgQueryFn('SELECT * FROM table2 ORDER BY id')

        expect(table2Rows.length).to.equal(2)
        
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: null
        })

        expect(table2Rows[1]).to.deep.equal({
          id: 'y',
          column1: 'e',
          column2: null,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: null
        })
      })

      it('should insert a many-to-many relationship which references the same table', async function() {
        let row = {
          column1: 'a',
          manyToManyRecursive: [
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

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToManyRecursive: [
            {
              table11_id: 1,
              table12_id: 2,
              column1: 'b',
              column2: null,
              column3: null,
              object12: {
                id: 2,
                column1: 'c',
                column2: null,
                column3: null,
                many_to_one_id: null,
                many_to_one_recursive_id: null,
                one_to_one_id: null,
                one_to_one_recursive_id: null,
                one_to_many_recursive_id: null
              }
            },
            {
              table11_id: 1,
              table12_id: 3,
              column1: 'd',
              column2: null,
              column3: null,
              object12: {
                id: 3,
                column1: 'e',
                column2: null,
                column3: null,
                many_to_one_id: null,
                many_to_one_recursive_id: null,
                one_to_one_id: null,
                one_to_one_recursive_id: null,
                one_to_many_recursive_id: null
              }
            }
          ]
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(3)

        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(table1Rows[1]).to.deep.equal({
          id: 2,
          column1: 'c',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(table1Rows[2]).to.deep.equal({
          id: 3,
          column1: 'e',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let tableManyRows = await pgQueryFn('SELECT * FROM many_to_many_recursive ORDER BY table11_id')

        expect(tableManyRows.length).to.equal(2)

        expect(tableManyRows[0]).to.deep.equal({
          table11_id: 1,
          table12_id: 2,
          column1: 'b',
          column2: null,
          column3: null
        })

        expect(tableManyRows[1]).to.deep.equal({
          table11_id: 1,
          table12_id: 3,
          column1: 'd',
          column2: null,
          column3: null
        })
      })

      it('should insert a many-to-many relationship which references the same table and which references back to the source row object', async function() {
        let row = {
          column1: 'a',
          manyToManyRecursive: [
            {
              column1: 'b',
              object11: {},
              object12: {
                column1: 'c',
                manyToManyRecursive: []
              } as any
            },
            {
              column1: 'd',
              object11: {},
              object12: {
                column1: 'e',
                manyToManyRecursive: []
              }
            }
          ]
        }

        row.manyToManyRecursive[0].object11 = row
        row.manyToManyRecursive[0].object12.manyToManyRecursive.push(row.manyToManyRecursive[0])
        row.manyToManyRecursive[1].object11 = row
        row.manyToManyRecursive[1].object12.manyToManyRecursive.push(row.manyToManyRecursive[1])

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToManyRecursive: [
            {
              table11_id: 1,
              table12_id: 2,
              column1: 'b',
              column2: null,
              column3: null,
              object11: {},
              object12: {
                id: 2,
                column1: 'c',
                column2: null,
                column3: null,
                many_to_one_id: null,
                many_to_one_recursive_id: null,
                one_to_one_id: null,
                one_to_one_recursive_id: null,
                one_to_many_recursive_id: null,
                // manyToManyRecursive: []
              } as any
            },
            {
              table11_id: 1,
              table12_id: 3,
              column1: 'd',
              column2: null,
              column3: null,
              object11: {},
              object12: {
                id: 3,
                column1: 'e',
                column2: null,
                column3: null,
                many_to_one_id: null,
                many_to_one_recursive_id: null,
                one_to_one_id: null,
                one_to_one_recursive_id: null,
                one_to_many_recursive_id: null,
                // manyToManyRecursive: []
              }
            }
          ]
        }

        expected.manyToManyRecursive[0].object11 = expected
        // expected.manyToManyRecursive[0].object12.manyToManyRecursive.push(expected.manyToManyRecursive[0])
        expected.manyToManyRecursive[1].object11 = expected
        // expected.manyToManyRecursive[1].object12.manyToManyRecursive.push(expected.manyToManyRecursive[1])

        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(3)

        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(table1Rows[1]).to.deep.equal({
          id: 2,
          column1: 'c',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(table1Rows[2]).to.deep.equal({
          id: 3,
          column1: 'e',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let tableManyRows = await pgQueryFn('SELECT * FROM many_to_many_recursive ORDER BY table11_id')

        expect(tableManyRows.length).to.equal(2)

        expect(tableManyRows[0]).to.deep.equal({
          table11_id: 1,
          table12_id: 2,
          column1: 'b',
          column2: null,
          column3: null
        })

        expect(tableManyRows[1]).to.deep.equal({
          table11_id: 1,
          table12_id: 3,
          column1: 'd',
          column2: null,
          column3: null
        })
      })

      it('should insert a many-to-many relationship which references the same entity', async function() {
        let row = {
          column1: 'a',
          manyToManyRecursive: [
            {
              column1: 'b',
              object12: {}
            },
            {
              column1: 'c',
              object12: {}
            }
          ]
        }

        row.manyToManyRecursive[0].object12 = row
        row.manyToManyRecursive[1].object12 = row

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToManyRecursive: [
            {
              table11_id: 1,
              table12_id: 1,
              column1: 'b',
              column2: null,
              column3: null,
              object12: {
                id: 1,
                column1: 'a',
                column2: null,
                column3: null,
                many_to_one_id: null,
                many_to_one_recursive_id: null,
                one_to_one_id: null,
                one_to_one_recursive_id: null,
                one_to_many_recursive_id: null
              }
            },
            {
              table11_id: 1,
              table12_id: 1,
              column1: 'c',
              column2: null,
              column3: null,
              object12: {
                id: 1,
                column1: 'a',
                column2: null,
                column3: null,
                many_to_one_id: null,
                many_to_one_recursive_id: null,
                one_to_one_id: null,
                one_to_one_recursive_id: null,
                one_to_many_recursive_id: null
              }
            }
          ]
        }

        expected.manyToManyRecursive[0].object12 = expected
        expected.manyToManyRecursive[1].object12 = expected

        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(1)

        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let tableManyRows = await pgQueryFn('SELECT * FROM many_to_many_recursive ORDER BY column1')

        expect(tableManyRows.length).to.equal(2)

        expect(tableManyRows[0]).to.deep.equal({
          table11_id: 1,
          table12_id: 1,
          column1: 'b',
          column2: null,
          column3: null
        })

        expect(tableManyRows[1]).to.deep.equal({
          table11_id: 1,
          table12_id: 1,
          column1: 'c',
          column2: null,
          column3: null
        })
      })

      it('should not insert the same object twice inside many-to-one', async function() {
        let table1Row = {
          column1: 'a',
          column2: 1
        }

        let row = {
          object1: table1Row,
          object12: table1Row
        }

        let insertedRow = await store(schema, 'table_many', 'postgres', pgQueryFn, row)

        expect(insertedRow.table1_id).to.equal(1)
        expect(insertedRow.table1_id2).to.equal(1)
        expect(insertedRow.object1).to.deep.equal({
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
        expect(insertedRow.object1 === insertedRow.object12).to.be.true

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
          manyObjects: [ tableManyRow, tableManyRow, tableManyRow ]
        }

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow.id).to.equal(1)
        expect(insertedRow.manyObjects).to.deep.equal([{
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

      it('should update a simple row', async function() {
        await pgQueryFn('INSERT INTO table1 (column1) VALUES ($1)', ['a'])
  
        let row = {
          id: 1,
          column1: 'b'
        }

        let updatedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)
  
        expect(updatedRow).to.be.not.undefined
        expect(updatedRow).to.deep.equal({
          id: 1,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        let rows = await pgQueryFn('SELECT * FROM table1')

        expect(rows.length).to.equal(1)
        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
        })
      })

      it('should update a many-to-one relationship which id is not generated', async function() {
        await pgQueryFn('INSERT INTO table1 (column1) VALUES ($1)', ['a'])
        await pgQueryFn('INSERT INTO table2 (id, column1) VALUES ($1, $2)', ['x', 'b'])

        let row = {
          id: 1,
          column1: 'b',
          manyToOne: {
            id: 'x',
            column1: 'c'
          }
        }

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_id: 'x',
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToOne: {
            id: 'x',
            column1: 'c',
            column2: null,
            column3: null,
            one_to_one_id: null,
            one_to_many_id: null
          }
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_id: 'x',
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
        })

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_id: null,
          one_to_many_id: null
        })
      })
    })

    describe('select', function() {
      it('should select all rows', async function() {
        let date1 = new Date
        let date2 = new Date
        let date3 = new Date
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', column2: 1, column3: date1 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'b', column2: 2, column3: date2 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'c', column2: 3, column3: date3 })

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {})

        expect(rows.length).to.equal(3)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: 1,
          column3: date1,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: 2,
          column3: date2,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(rows[2]).to.deep.equal({
          id: 3,
          column1: 'c',
          column2: 3,
          column3: date3,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })
      })

      it('should order by a column', async function() {
        let date1 = new Date
        let date2 = new Date
        let date3 = new Date
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', column2: 1, column3: date1 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'b', column2: 2, column3: date2 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'c', column2: 3, column3: date3 })

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          '@orderBy': {
            field: 'column2',
            direction: 'DESC'
          }
        })

        expect(rows.length).to.equal(3)
        
        expect(rows[0]).to.deep.equal({
          id: 3,
          column1: 'c',
          column2: 3,
          column3: date3,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: 2,
          column3: date2,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(rows[2]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: 1,
          column3: date1,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })
      })

      it('should limit the results', async function() {
        let date1 = new Date
        let date2 = new Date
        let date3 = new Date
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', column2: 1, column3: date1 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'b', column2: 2, column3: date2 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'c', column2: 3, column3: date3 })

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          '@limit': 2
        })

        expect(rows.length).to.equal(2)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: 1,
          column3: date1,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })

        expect(rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: 2,
          column3: date2,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })
      })

      it('should offset the results', async function() {
        let date1 = new Date
        let date2 = new Date
        let date3 = new Date
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', column2: 1, column3: date1 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'b', column2: 2, column3: date2 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'c', column2: 3, column3: date3 })

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          '@offset': 2
        })

        expect(rows.length).to.equal(1)

        expect(rows[0]).to.deep.equal({
          id: 3,
          column1: 'c',
          column2: 3,
          column3: date3,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })
      })

      it('should regard criteria in a many-to-one relationship', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 1 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 2 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 3 }})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          manyToOneRecursive: {
            column2: 1
          }
        })

        expect(rows.length).to.equal(1)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 2,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })
      })

      it('should regard criteria in a many-to-one relationship regarding the id', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { manyToOneRecursive: { } })
        await store(schema, 'table1', 'postgres', pgQueryFn, { manyToOneRecursive: { } })
        await store(schema, 'table1', 'postgres', pgQueryFn, { manyToOneRecursive: { } })

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          manyToOneRecursive: {
            id: 2
          }
        })

        expect(rows.length).to.equal(1)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: null,
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 2,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })
      })

      it('should regard criteria in a many-to-one relationship and load it', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 1 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 2 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 3 }})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          manyToOneRecursive: {
            '@load': true,
            column2: 1
          }
        })

        expect(rows.length).to.equal(1)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 2,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToOneRecursive: {
            id: 2,
            column1: null,
            column2: 1,
            column3: null,
            many_to_one_id: null,
            many_to_one_recursive_id: null,
            one_to_one_id: null,
            one_to_one_recursive_id: null,
            one_to_many_recursive_id: null
          }
        })
      })

      it('should load a many-to-one relationship separately', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 1 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 2 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 3 }})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          manyToOneRecursive: {
            '@loadSeparately': true,
            column2: 1
          }
        })

        expect(rows.length).to.equal(3)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 2,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToOneRecursive: {
            id: 2,
            column1: null,
            column2: 1,
            column3: null,
            many_to_one_id: null,
            many_to_one_recursive_id: null,
            one_to_one_id: null,
            one_to_one_recursive_id: null,
            one_to_many_recursive_id: null
          }
        })

        expect(rows[1]).to.deep.equal({
          id: 3,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 4,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToOneRecursive: null
        })

        expect(rows[2]).to.deep.equal({
          id: 5,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 6,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToOneRecursive: null
        })
      })

      it('should regard criteria in a one-to-many relationship', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyRecursive: [ { column1: 'd' }, { column1: 'e' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyRecursive: [ { column1: 'f' }, { column1: 'g' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyRecursive: [ { column1: 'h' }, { column1: 'i' } ]})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          oneToManyRecursive: {
            column1: 'd'
          }
        })

        expect(rows.length).to.equal(1)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        })
      })

      it('should regard criteria in a one-to-many relationship and load it', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyRecursive: [ { column1: 'd' }, { column1: 'e' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyRecursive: [ { column1: 'f' }, { column1: 'g' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyRecursive: [ { column1: 'h' }, { column1: 'i' } ]})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          oneToManyRecursive: {
            '@load': true,
            column1: 'd'
          }
        })

        expect(rows.length).to.equal(1)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          oneToManyRecursive: [
            {
              id: 2,
              column1: 'd',
              column2: null,
              column3: null,
              many_to_one_id: null,
              many_to_one_recursive_id: null,
              one_to_one_id: null,
              one_to_one_recursive_id: null,
              one_to_many_recursive_id: 1
            }
          ]
        })
      })

      it('should load a one-to-many relationship separately', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyRecursive: [ { column1: 'd' }, { column1: 'e' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyRecursive: [ { column1: 'f' }, { column1: 'g' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyRecursive: [ { column1: 'h' }, { column1: 'i' } ]})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          oneToManyRecursive: {
            '@loadSeparately': true,
            column1: 'd'
          }
        })

        expect(rows.length).to.equal(3)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          oneToManyRecursive: [
            {
              id: 2,
              column1: 'd',
              column2: null,
              column3: null,
              many_to_one_id: null,
              many_to_one_recursive_id: null,
              one_to_one_id: null,
              one_to_one_recursive_id: null,
              one_to_many_recursive_id: 1
            }
          ]
        })

        expect(rows[1]).to.deep.equal({
          id: 4,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          oneToManyRecursive: []
        })

        expect(rows[2]).to.deep.equal({
          id: 7,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          oneToManyRecursive: []
        })
      })

      it('should process criteria given as array', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 1 }, oneToManyRecursive: [ { column1: 'd' }, { column1: 'e' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 2 }, oneToManyRecursive: [ { column1: 'f' }, { column1: 'g' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneRecursive: { column2: 3 }, oneToManyRecursive: [ { column1: 'h' }, { column1: 'i' } ]})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, [
          {
            column1: 'a',
            manyToOneRecursive: {
              '@load': true,
              column2: 1
            }
          },
          'OR',
          {
            column1: 'a',
            oneToManyRecursive: {
              '@loadSeparately': true,
              column1: 'd'
            }
          }
        ])

        expect(rows.length).to.equal(3)
        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 2,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToOneRecursive: {
            id: 2,
            column1: null,
            column2: 1,
            column3: null,
            many_to_one_id: null,
            many_to_one_recursive_id: null,
            one_to_one_id: null,
            one_to_one_recursive_id: null,
            one_to_many_recursive_id: null
          },
          oneToManyRecursive: [
            {
              id: 3,
              column1: 'd',
              column2: null,
              column3: null,
              many_to_one_id: null,
              many_to_one_recursive_id: null,
              one_to_one_id: null,
              one_to_one_recursive_id: null,
              one_to_many_recursive_id: 1
            }
          ]
        })

        expect(rows[1]).to.deep.equal({
          id: 5,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 6,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToOneRecursive: {
            id: 6,
            column1: null,
            column2: 2,
            column3: null,
            many_to_one_id: null,
            many_to_one_recursive_id: null,
            one_to_one_id: null,
            one_to_one_recursive_id: null,
            one_to_many_recursive_id: null
          },
          oneToManyRecursive: []
        })

        expect(rows[2]).to.deep.equal({
          id: 9,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: 10,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null,
          manyToOneRecursive: {
            id: 10,
            column1: null,
            column2: 3,
            column3: null,
            many_to_one_id: null,
            many_to_one_recursive_id: null,
            one_to_one_id: null,
            one_to_one_recursive_id: null,
            one_to_many_recursive_id: null
          },
          oneToManyRecursive: []
        })
      })

      it('should not select rows which columns are null', async function() {
        await store(schema, 'many_to_many', 'postgres', pgQueryFn, {})
        await store(schema, 'many_to_many', 'postgres', pgQueryFn, {})
        await store(schema, 'many_to_many', 'postgres', pgQueryFn, {})

        let rows = await select(schema, 'many_to_many', 'postgres', pgQueryFn, {})

        expect(rows.length).to.equal(0)
      })
    })

    describe('delete_', function() {
      it('should delete a simple row by id', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', column2: 1 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'b', column2: 2 })

        let deletedRows = await delete_(schema, 'table1', 'postgres', pgQueryFn, { id: 1 })

        expect(deletedRows).to.deep.equal([{
          id: 1,
          column1: 'a',
          column2: 1,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        }])

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows).to.deep.equal([{
          id: 2,
          column1: 'b',
          column2: 2,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        }])
      })

      it('should delete a simple row by another column than the id', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', column2: 1 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'b', column2: 2 })

        let deletedRows = await delete_(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a' })

        expect(deletedRows).to.deep.equal([{
          id: 1,
          column1: 'a',
          column2: 1,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        }])

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows).to.deep.equal([{
          id: 2,
          column1: 'b',
          column2: 2,
          column3: null,
          many_to_one_id: null,
          many_to_one_recursive_id: null,
          one_to_one_id: null,
          one_to_one_recursive_id: null,
          one_to_many_recursive_id: null
        }])
      })

      it('should not delete anything if the criteria contained invalid columns', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', column2: 1 })
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'b', column2: 2 })

        expect(delete_(schema, 'table1', 'postgres', pgQueryFn, { invalid: 'invalid' })).to.be.rejectedWith(Error)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(2)
        expect(table1Rows).to.deep.equal([
          {
            id: 1,
            column1: 'a',
            column2: 1,
            column3: null,
            many_to_one_id: null,
            many_to_one_recursive_id: null,
            one_to_one_id: null,
            one_to_one_recursive_id: null,
            one_to_many_recursive_id: null
            },
          {
            id: 2,
            column1: 'b',
            column2: 2,
            column3: null,
            many_to_one_id: null,
            many_to_one_recursive_id: null,
            one_to_one_id: null,
            one_to_one_recursive_id: null,
            one_to_many_recursive_id: null
            }
        ])
      })
    })
  })
})

async function pgQueryFn(sqlString: string, values?: any[]): Promise<any[]> {
  let result = await pool.query(sqlString, values)
  return result.rows
}