import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { delete_, store } from '../src/orm'
import { schema } from './testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

let pool: Pool = new Pool({
  host: 'postgres',
  database: 'sqlorm_test',
  user: 'sqlorm_test',
  password: 'sqlorm_test'
} as PoolConfig)

function pgQueryFn(sqlString: string, values?: any[]): Promise<any> {
  return pool.query(sqlString, values)
}

describe('orm', function() {
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

  describe('store', function() {
    it('should insert a simple row', async function() {
      let row = {
        column1: 'a'
      }

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false
      })

      let result = await pgQueryFn('SELECT * FROM table1')

      expect(result.rows.length).to.equal(1)
      expect(result.rows[0]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToOneObject2: {
          id: 'x',
          '@update': false
        }
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
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

      let table2Result = await pgQueryFn('SELECT * FROM table2')

      expect(table2Result.rows.length).to.equal(1)
      expect(table2Result.rows[0]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 2,
        '@update': false,
        manyToOneObject1: {
          id: 1,
          '@update': false
        }
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

      expect(table1Result.rows.length).to.equal(2)
      expect(table1Result.rows[0]).to.deep.equal({
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

      expect(table1Result.rows[1]).to.deep.equal({
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

    it('should insert a one-to-one relationship', async function() {
      let row = {
        column1: 'a',
        oneToOneObject2: {
          id: 'x',
          column1: 'b'
        }
      }

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToOneObject2: {
          id: 'x',
          '@update': false
        }
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
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

      let table2Result = await pgQueryFn('SELECT * FROM table2')

      expect(table2Result.rows.length).to.equal(1)
      expect(table2Result.rows[0]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToOneObject2: {
          id: 'x',
          '@update': false
        }
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
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

      let table2Result = await pgQueryFn('SELECT * FROM table2')

      expect(table2Result.rows.length).to.equal(1)
      expect(table2Result.rows[0]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 2,
        '@update': false,
        oneToOneObject1: {
          id: 1,
          '@update': false
        }
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

      expect(table1Result.rows.length).to.equal(2)
      expect(table1Result.rows[0]).to.deep.equal({
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

      expect(table1Result.rows[1]).to.deep.equal({
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

    it('should insert a one-to-one relationship which references the same table and which also references back to the source row object', async function() {
      let row = {
        column1: 'a',
        oneToOneObject1: {
          column1: 'b',
          oneToOneObject1: {}
        }
      }

      row.oneToOneObject1.oneToOneObject1 = row

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 2,
        '@update': false,
        oneToOneObject1: {
          id: 1,
          '@update': false
        }
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

      expect(table1Result.rows.length).to.equal(2)
      expect(table1Result.rows[0]).to.deep.equal({
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

      expect(table1Result.rows[1]).to.deep.equal({
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

    it('should insert a one-to-one relationship which references the same entity', async function() {
      let row = {
        column1: 'a',
        oneToOneObject1: {}
      }

      row.oneToOneObject1 = row

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })
      
      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToManyObject2: [
          {
            id: 'x',
            '@update': false
          },
          {
            id: 'y',
            '@update': false
          }
        ]
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
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

      let table2Result = await pgQueryFn('SELECT * FROM table2')

      expect(table2Result.rows.length).to.equal(2)
      
      expect(table2Result.rows[0]).to.deep.equal({
        id: 'x',
        column1: 'b',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })

      expect(table2Result.rows[1]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToManyObject2: [
          {
            id: 'x',
            '@update': false
          },
          {
            id: 'y',
            '@update': false
          }
        ]
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
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

      let table2Result = await pgQueryFn('SELECT * FROM table2')

      expect(table2Result.rows.length).to.equal(2)
      
      expect(table2Result.rows[0]).to.deep.equal({
        id: 'x',
        column1: 'b',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })

      expect(table2Result.rows[1]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToManyObject1: [
          {
            id: 2,
            '@update': false
          },
          {
            id: 3,
            '@update': false
          }
        ]
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(3)

      expect(table1Result.rows[0]).to.deep.equal({
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

      expect(table1Result.rows[1]).to.deep.equal({
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

      expect(table1Result.rows[2]).to.deep.equal({
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
      
      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToManyObject1: [
          {
            id: 2,
            '@update': false
          },
          {
            id: 3,
            '@update': false,
          }
        ]
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(3)

      expect(table1Result.rows[0]).to.deep.equal({
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

      expect(table1Result.rows[1]).to.deep.equal({
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

      expect(table1Result.rows[2]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject2: [
          {
            table1_id: 1,
            table2_id: 'x',
            '@update': false,
            object2: {
              id: 'x',
              '@update': false,
            }
          },
          {
            table1_id: 1,
            table2_id: 'y',
            '@update': false,
            object2: {
              id: 'y',
              '@update': false
            }
          }
        ]
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
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

      let tableManyResult = await pgQueryFn('SELECT * FROM many_to_many_table2 ORDER BY table1_id')

      expect(tableManyResult.rows.length).to.equal(2)

      expect(tableManyResult.rows[0]).to.deep.equal({
        table1_id: 1,
        table2_id: 'x',
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult.rows[1]).to.deep.equal({
        table1_id: 1,
        table2_id: 'y',
        column1: 'd',
        column2: null,
        column3: null
      })

      let table2Result = await pgQueryFn('SELECT * FROM table2 ORDER BY id')

      expect(table2Result.rows.length).to.equal(2)
      
      expect(table2Result.rows[0]).to.deep.equal({
        id: 'x',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })

      expect(table2Result.rows[1]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject2: [
          {
            table1_id: 1,
            table2_id: 'x',
            '@update': false,
            object2: {
              id: 'x',
              '@update': false
            }
          },
          {
            table1_id: 1,
            table2_id: 'y',
            '@update': false,
            object2: {
              id: 'y',
              '@update': false
            }
          }
        ]
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
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

      let tableManyResult = await pgQueryFn('SELECT * FROM many_to_many_table2 ORDER BY table1_id')

      expect(tableManyResult.rows.length).to.equal(2)

      expect(tableManyResult.rows[0]).to.deep.equal({
        table1_id: 1,
        table2_id: 'x',
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult.rows[1]).to.deep.equal({
        table1_id: 1,
        table2_id: 'y',
        column1: 'd',
        column2: null,
        column3: null
      })

      let table2Result = await pgQueryFn('SELECT * FROM table2 ORDER BY id')

      expect(table2Result.rows.length).to.equal(2)
      
      expect(table2Result.rows[0]).to.deep.equal({
        id: 'x',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })

      expect(table2Result.rows[1]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject1: [
          {
            table1_id1: 1,
            table1_id2: 2,
            '@update': false,
            object12: {
              id: 2,
              '@update': false,
            }
          },
          {
            table1_id1: 1,
            table1_id2: 3,
            '@update': false,
            object12: {
              id: 3,
              '@update': false,
            }
          }
        ]
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

      expect(table1Result.rows.length).to.equal(3)

      expect(table1Result.rows[0]).to.deep.equal({
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

      expect(table1Result.rows[1]).to.deep.equal({
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

      expect(table1Result.rows[2]).to.deep.equal({
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

      let tableManyResult = await pgQueryFn('SELECT * FROM many_to_many_table1 ORDER BY table1_id1')

      expect(tableManyResult.rows.length).to.equal(2)

      expect(tableManyResult.rows[0]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 2,
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult.rows[1]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject1: [
          {
            table1_id1: 1,
            table1_id2: 2,
            '@update': false,
            object12: {
              id: 2,
              '@update': false
            }
          },
          {
            table1_id1: 1,
            table1_id2: 3,
            '@update': false,
            object12: {
              id: 3,
              '@update': false
            }
          }
        ]
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

      expect(table1Result.rows.length).to.equal(3)

      expect(table1Result.rows[0]).to.deep.equal({
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

      expect(table1Result.rows[1]).to.deep.equal({
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

      expect(table1Result.rows[2]).to.deep.equal({
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

      let tableManyResult = await pgQueryFn('SELECT * FROM many_to_many_table1 ORDER BY table1_id1')

      expect(tableManyResult.rows.length).to.equal(2)

      expect(tableManyResult.rows[0]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 2,
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult.rows[1]).to.deep.equal({
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
          }
        ]
      }

      row.manyToManyObject1[0].object12 = row

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject1: [
          {
            table1_id1: 1,
            table1_id2: 1,
            '@update': false
          }
        ]
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

      expect(table1Result.rows.length).to.equal(1)

      expect(table1Result.rows[0]).to.deep.equal({
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

      let tableManyResult = await pgQueryFn('SELECT * FROM many_to_many_table1 ORDER BY column1')

      expect(tableManyResult.rows.length).to.equal(1)

      expect(tableManyResult.rows[0]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 1,
        column1: 'b',
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': true
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
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

      let storeInfo = await store(schema.getTable('table1'), 'postgres', pgQueryFn, row, { asDatabaseRow: true })

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': true,
        manyToOneObject2: {
          id: 'x',
          '@update': true
        }
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
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

      let table2Result = await pgQueryFn('SELECT * FROM table2')

      expect(table2Result.rows.length).to.equal(1)
      expect(table2Result.rows[0]).to.deep.equal({
        id: 'x',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })
  })

  describe('delete', function() {
    it('should delete an entity', async function() {
      await pgQueryFn('INSERT INTO table1 (column1) VALUES ($1)', ['a'])
      await pgQueryFn('INSERT INTO table1 (column1) VALUES ($1)', ['b'])

      let result = await delete_(schema.getTable('table1'), 'postgres', pgQueryFn, { id: 1 })

      expect(result).to.deep.equal({
        id: 1
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
        id: 2,
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

    it('should not delete anything if the primary key is missing', async function() {
      await pgQueryFn('INSERT INTO table1 (column1) VALUES ($1)', ['a'])
      await pgQueryFn('INSERT INTO table1 (column1) VALUES ($1)', ['b'])

      expect(delete_(schema.getTable('table1'), 'postgres', pgQueryFn, { })).to.be.rejectedWith('Could not delete object because the primary key is not set.')

      let table1Result = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

      expect(table1Result.rows.length).to.equal(2)
      expect(table1Result.rows[0]).to.deep.equal({
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

      expect(table1Result.rows[1]).to.deep.equal({
        id: 2,
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
  })
})
