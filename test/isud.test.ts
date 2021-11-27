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

        let result = await isUpdate(schema, 'many_to_many_table2', 'postgres', pgQueryFn, row)

        expect(result).to.be.false
      })

      it('should return true if a row with the composite primary key does already exist', async function() {
        await pgQueryFn('INSERT INTO many_to_many_table2 (table1_id, table2_id) VALUES (1, \'x\')')

        let row = {
          table1_id: 1,
          table2_id: 'x'
        }

        let result = await isUpdate(schema, 'many_to_many_table2', 'postgres', pgQueryFn, row)

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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        let rows = await pgQueryFn('SELECT * FROM table1')

        expect(rows.length).to.equal(1)
        expect(rows[0]).to.deep.equal({
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

      it('should insert a many-to-one relationship which primary key is not generated', async function() {
        let row = {
          column1: 'a',
          manyToOneObject2: {
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

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
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

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        })
      })

      it('should insert a many-to-one relationship which primary key is generated', async function() {
        let row = {
          column1: 'a',
          manyToOneObject1: {
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
          many_to_one_object1_id: 2,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          manyToOneObject1: {
            id: 2,
            column1: 'b',
            column2: null,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null,
            }
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(2)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: 2,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        expect(table1Rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })
      })

      it('should insert a one-to-one relationship', async function() {
        let row = {
          column1: 'a',
          oneToOneObject2: {
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

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
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

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: 1,
          one_to_many_object2_many_to_one_id: null
        })
      })

      it('should insert a one-to-one relationship which also references back to the source row object', async function() {
        let row = {
          column1: 'a',
          oneToOneObject2: {
            id: 'x',
            column1: 'b',
            oneToOneObject1: {}
          }
        }

        row.oneToOneObject2.oneToOneObject1 = row

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
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
            one_to_many_object2_many_to_one_id: null,
            oneToOneObject1: {}
          }
        }

        expected.oneToOneObject2.oneToOneObject1 = expected

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
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

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: 1,
          one_to_many_object2_many_to_one_id: null
        })
      })

      it('should insert a one-to-one relationship which references the same table', async function() {
        let row = {
          column1: 'a',
          oneToOneObject1: {
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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 2,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          oneToOneObject1: {
            id: 2,
            column1: 'b',
            column2: null,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: 1,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
            }
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(2)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 2,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        expect(table1Rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 1,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })
      })

      it('should insert a one-to-one relationship which references the same table and which also references back to the source row object', async function() {
        let row = {
          column1: 'a',
          oneToOneObject1: {
            column1: 'b',
            oneToOneObject1: {}
          }
        }

        row.oneToOneObject1.oneToOneObject1 = row

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object2_id: null,
          many_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_one_object1_id: 2,
          one_to_many_object1_many_to_one_id: null,
          oneToOneObject1: {
            id: 2,
            column1: 'b',
            column2: null,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: 1,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null,
            oneToOneObject1: {}
          }
        }

        expected.oneToOneObject1.oneToOneObject1 = expected

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(2)
        expect(table1Rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 2,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        expect(table1Rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 1,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })
      })

      it('should insert a one-to-one relationship which references the same entity', async function() {
        let row = {
          column1: 'a',
          oneToOneObject1: {}
        }

        row.oneToOneObject1 = row

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)
        
        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: 1,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          oneToOneObject1: {}
        }

        expected.oneToOneObject1 = expected

        expect(insertedRow).to.be.not.undefined
        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
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

      it('should insert a one-to-many relationship', async function() {
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

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.not.be.undefined
        expect(insertedRow).to.deep.equal({
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
            },
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

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
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

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(2)
        
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: 1
        })

        expect(table2Rows[1]).to.deep.equal({
          id: 'y',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: 1
        })
      })

      it('should insert a one-to-many relationship which also references back to the source row object', async function() {
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

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object2_id: null,
          many_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_many_object1_many_to_one_id: null,
          oneToManyObject2: [
            {
              id: 'x',
              column1: 'b',
              column2: null,
              column3: null,
              one_to_one_object1_id: null,
              one_to_many_object2_many_to_one_id: 1,
              oneToManyObject2ManyToOne: {}
            },
            {
              id: 'y',
              column1: 'c',
              column2: null,
              column3: null,
              one_to_one_object1_id: null,
              one_to_many_object2_many_to_one_id: 1,
              oneToManyObject2ManyToOne: {}
            }
          ]
        }

        expected.oneToManyObject2[0].oneToManyObject2ManyToOne = expected
        expected.oneToManyObject2[1].oneToManyObject2ManyToOne = expected

        expect(insertedRow).to.not.be.undefined
        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
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

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(2)
        
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'b',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: 1
        })

        expect(table2Rows[1]).to.deep.equal({
          id: 'y',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: 1
        })
      })

      it('should insert a one-to-many relationship which references the same table', async function() {
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

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.not.be.undefined
        expect(insertedRow).to.deep.equal({
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

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(3)

        expect(table1Rows[0]).to.deep.equal({
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

        expect(table1Rows[1]).to.deep.equal({
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

        expect(table1Rows[2]).to.deep.equal({
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

      it('should insert a one-to-many relationship which references the same table and which also references back to the source row object', async function() {
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
        
        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
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
              oneToManyObject1ManyToOne: {}
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
              one_to_many_object1_many_to_one_id: 1,
              oneToManyObject1ManyToOne: {}
            }
          ]
        }

        expected.oneToManyObject1[0].oneToManyObject1ManyToOne = expected
        expected.oneToManyObject1[1].oneToManyObject1ManyToOne = expected
        
        expect(insertedRow).to.not.be.undefined
        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(3)

        expect(table1Rows[0]).to.deep.equal({
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

        expect(table1Rows[1]).to.deep.equal({
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

        expect(table1Rows[2]).to.deep.equal({
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

      it('should insert a many-to-many relationship', async function() {
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

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object2_id: null,
          many_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_one_object1_id: null,
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
                one_to_one_object1_id: null,
                one_to_many_object2_many_to_one_id: null
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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        let tableManyRows = await pgQueryFn('SELECT * FROM many_to_many_table2 ORDER BY table1_id')

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
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        })

        expect(table2Rows[1]).to.deep.equal({
          id: 'y',
          column1: 'e',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        })
      })

      it('should insert a many-to-many relationship which also references back to the source row object', async function() {
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

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
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
              object1: {},
              object2: {
                id: 'x',
                column1: 'c',
                column2: null,
                column3: null,
                one_to_one_object1_id: null,
                one_to_many_object2_many_to_one_id: null,
                // manyToManyObject2: []
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
                one_to_one_object1_id: null,
                one_to_many_object2_many_to_one_id: null,
                // manyToManyObject2: []
              }
            }
          ]
        }

        expected.manyToManyObject2[0].object1 = expected
        // expected.manyToManyObject2[0].object2.manyToManyObject2.push(expected.manyToManyObject2[0])
        expected.manyToManyObject2[1].object1 = expected
        // expected.manyToManyObject2[1].object2.manyToManyObject2.push(expected.manyToManyObject2[1])

        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
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

        let tableManyRows = await pgQueryFn('SELECT * FROM many_to_many_table2 ORDER BY table1_id')

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
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        })

        expect(table2Rows[1]).to.deep.equal({
          id: 'y',
          column1: 'e',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
        })
      })

      it('should insert a many-to-many relationship which references the same table', async function() {
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

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        expect(insertedRow).to.deep.equal({
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

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(3)

        expect(table1Rows[0]).to.deep.equal({
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

        expect(table1Rows[1]).to.deep.equal({
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

        expect(table1Rows[2]).to.deep.equal({
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

        let tableManyRows = await pgQueryFn('SELECT * FROM many_to_many_table1 ORDER BY table1_id1')

        expect(tableManyRows.length).to.equal(2)

        expect(tableManyRows[0]).to.deep.equal({
          table1_id1: 1,
          table1_id2: 2,
          column1: 'b',
          column2: null,
          column3: null
        })

        expect(tableManyRows[1]).to.deep.equal({
          table1_id1: 1,
          table1_id2: 3,
          column1: 'd',
          column2: null,
          column3: null
        })
      })

      it('should insert a many-to-many relationship which references the same table and which references back to the source row object', async function() {
        let row = {
          column1: 'a',
          manyToManyObject1: [
            {
              column1: 'b',
              object11: {},
              object12: {
                column1: 'c',
                manyToManyObject1: []
              } as any
            },
            {
              column1: 'd',
              object11: {},
              object12: {
                column1: 'e',
                manyToManyObject1: []
              }
            }
          ]
        }

        row.manyToManyObject1[0].object11 = row
        row.manyToManyObject1[0].object12.manyToManyObject1.push(row.manyToManyObject1[0])
        row.manyToManyObject1[1].object11 = row
        row.manyToManyObject1[1].object12.manyToManyObject1.push(row.manyToManyObject1[1])

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
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
              object11: {},
              object12: {
                id: 2,
                column1: 'c',
                column2: null,
                column3: null,
                many_to_one_object1_id: null,
                many_to_one_object2_id: null,
                one_to_one_object1_id: null,
                one_to_one_object2_id: null,
                one_to_many_object1_many_to_one_id: null,
                // manyToManyObject1: []
              } as any
            },
            {
              table1_id1: 1,
              table1_id2: 3,
              column1: 'd',
              column2: null,
              column3: null,
              object11: {},
              object12: {
                id: 3,
                column1: 'e',
                column2: null,
                column3: null,
                many_to_one_object2_id: null,
                many_to_one_object1_id: null,
                one_to_one_object2_id: null,
                one_to_one_object1_id: null,
                one_to_many_object1_many_to_one_id: null,
                // manyToManyObject1: []
              }
            }
          ]
        }

        expected.manyToManyObject1[0].object11 = expected
        // expected.manyToManyObject1[0].object12.manyToManyObject1.push(expected.manyToManyObject1[0])
        expected.manyToManyObject1[1].object11 = expected
        // expected.manyToManyObject1[1].object12.manyToManyObject1.push(expected.manyToManyObject1[1])

        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(3)

        expect(table1Rows[0]).to.deep.equal({
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

        expect(table1Rows[1]).to.deep.equal({
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

        expect(table1Rows[2]).to.deep.equal({
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

        let tableManyRows = await pgQueryFn('SELECT * FROM many_to_many_table1 ORDER BY table1_id1')

        expect(tableManyRows.length).to.equal(2)

        expect(tableManyRows[0]).to.deep.equal({
          table1_id1: 1,
          table1_id2: 2,
          column1: 'b',
          column2: null,
          column3: null
        })

        expect(tableManyRows[1]).to.deep.equal({
          table1_id1: 1,
          table1_id2: 3,
          column1: 'd',
          column2: null,
          column3: null
        })
      })

      it('should insert a many-to-many relationship which references the same entity', async function() {
        let row = {
          column1: 'a',
          manyToManyObject1: [
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

        row.manyToManyObject1[0].object12 = row
        row.manyToManyObject1[1].object12 = row

        let insertedRow = await store(schema, 'table1', 'postgres', pgQueryFn, row)

        let expected = {
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
              column3: null,
              object12: {
                id: 1,
                column1: 'a',
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
              table1_id2: 1,
              column1: 'c',
              column2: null,
              column3: null,
              object12: {
                id: 1,
                column1: 'a',
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

        expected.manyToManyObject1[0].object12 = expected
        expected.manyToManyObject1[1].object12 = expected

        expect(insertedRow).to.deep.equal(expected)

        let table1Rows = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

        expect(table1Rows.length).to.equal(1)

        expect(table1Rows[0]).to.deep.equal({
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

        let tableManyRows = await pgQueryFn('SELECT * FROM many_to_many_table1 ORDER BY column1')

        expect(tableManyRows.length).to.equal(2)

        expect(tableManyRows[0]).to.deep.equal({
          table1_id1: 1,
          table1_id2: 1,
          column1: 'b',
          column2: null,
          column3: null
        })

        expect(tableManyRows[1]).to.deep.equal({
          table1_id1: 1,
          table1_id2: 1,
          column1: 'c',
          column2: null,
          column3: null
        })
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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        let rows = await pgQueryFn('SELECT * FROM table1')

        expect(rows.length).to.equal(1)
        expect(rows[0]).to.deep.equal({
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

      it('should update a many-to-one relationship which id is not generated', async function() {
        await pgQueryFn('INSERT INTO table1 (column1) VALUES ($1)', ['a'])
        await pgQueryFn('INSERT INTO table2 (id, column1) VALUES ($1, $2)', ['x', 'b'])

        let row = {
          id: 1,
          column1: 'b',
          manyToOneObject2: {
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

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0]).to.deep.equal({
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

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0]).to.deep.equal({
          id: 'x',
          column1: 'c',
          column2: null,
          column3: null,
          one_to_one_object1_id: null,
          one_to_many_object2_many_to_one_id: null
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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        expect(rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: 2,
          column3: date2,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        expect(rows[2]).to.deep.equal({
          id: 3,
          column1: 'c',
          column2: 3,
          column3: date3,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        expect(rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: 2,
          column3: date2,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        expect(rows[2]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: 1,
          column3: date1,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })

        expect(rows[1]).to.deep.equal({
          id: 2,
          column1: 'b',
          column2: 2,
          column3: date2,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })
      })

      it('should regard criteria in a many-to-one relationship', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 1 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 2 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 3 }})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          manyToOneObject1: {
            column2: 1
          }
        })

        expect(rows.length).to.equal(1)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: 2,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })
      })

      it('should regard criteria in a many-to-one relationship regarding the id', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { manyToOneObject1: { } })
        await store(schema, 'table1', 'postgres', pgQueryFn, { manyToOneObject1: { } })
        await store(schema, 'table1', 'postgres', pgQueryFn, { manyToOneObject1: { } })

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          manyToOneObject1: {
            id: 2
          }
        })

        expect(rows.length).to.equal(1)

        expect(rows[0]).to.deep.equal({
          id: 1,
          column1: null,
          column2: null,
          column3: null,
          many_to_one_object1_id: 2,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        })
      })

      it('should regard criteria in a many-to-one relationship and load it', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 1 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 2 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 3 }})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          manyToOneObject1: {
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
          many_to_one_object1_id: 2,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          manyToOneObject1: {
            id: 2,
            column1: null,
            column2: 1,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
          }
        })
      })

      it('should load a many-to-one relationship separately', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 1 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 2 }})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 3 }})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          manyToOneObject1: {
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
          many_to_one_object1_id: 2,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          manyToOneObject1: {
            id: 2,
            column1: null,
            column2: 1,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
          }
        })

        expect(rows[1]).to.deep.equal({
          id: 3,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: 4,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          manyToOneObject1: null
        })

        expect(rows[2]).to.deep.equal({
          id: 5,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: 6,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          manyToOneObject1: null
        })
      })

      it('should regard criteria in a one-to-many relationship', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'd' }, { column1: 'e' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'f' }, { column1: 'g' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'h' }, { column1: 'i' } ]})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          oneToManyObject1: {
            column1: 'd'
          }
        })

        expect(rows.length).to.equal(1)

        expect(rows[0]).to.deep.equal({
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
      })

      it('should regard criteria in a one-to-many relationship and load it', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'd' }, { column1: 'e' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'f' }, { column1: 'g' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'h' }, { column1: 'i' } ]})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          oneToManyObject1: {
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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          oneToManyObject1: [
            {
              id: 2,
              column1: 'd',
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
      })

      it('should load a one-to-many relationship separately', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'd' }, { column1: 'e' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'f' }, { column1: 'g' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'h' }, { column1: 'i' } ]})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, {
          column1: 'a',
          oneToManyObject1: {
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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          oneToManyObject1: [
            {
              id: 2,
              column1: 'd',
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

        expect(rows[1]).to.deep.equal({
          id: 4,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          oneToManyObject1: []
        })

        expect(rows[2]).to.deep.equal({
          id: 7,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          oneToManyObject1: []
        })
      })

      it('should process criteria given as array', async function() {
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 1 }, oneToManyObject1: [ { column1: 'd' }, { column1: 'e' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 2 }, oneToManyObject1: [ { column1: 'f' }, { column1: 'g' } ]})
        await store(schema, 'table1', 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 3 }, oneToManyObject1: [ { column1: 'h' }, { column1: 'i' } ]})

        let rows = await select(schema, 'table1', 'postgres', pgQueryFn, [
          {
            column1: 'a',
            manyToOneObject1: {
              '@load': true,
              column2: 1
            }
          },
          'OR',
          {
            column1: 'a',
            oneToManyObject1: {
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
          many_to_one_object1_id: 2,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          manyToOneObject1: {
            id: 2,
            column1: null,
            column2: 1,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
          },
          oneToManyObject1: [
            {
              id: 3,
              column1: 'd',
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

        expect(rows[1]).to.deep.equal({
          id: 5,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: 6,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          manyToOneObject1: {
            id: 6,
            column1: null,
            column2: 2,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
          },
          oneToManyObject1: []
        })

        expect(rows[2]).to.deep.equal({
          id: 9,
          column1: 'a',
          column2: null,
          column3: null,
          many_to_one_object1_id: 10,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null,
          manyToOneObject1: {
            id: 10,
            column1: null,
            column2: 3,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
          },
          oneToManyObject1: []
        })
      })

      it('should not select rows which columns are null', async function() {
        await pgQueryFn('INSERT INTO table2 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table2 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table2 DEFAULT VALUES')

        let rows = await select(schema, 'table2', 'postgres', pgQueryFn, {})

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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }])

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows).to.deep.equal([{
          id: 2,
          column1: 'b',
          column2: 2,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
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
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }])

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows).to.deep.equal([{
          id: 2,
          column1: 'b',
          column2: 2,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
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
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
            },
          {
            id: 2,
            column1: 'b',
            column2: 2,
            column3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: null
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