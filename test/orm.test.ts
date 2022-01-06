import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { Orm } from '../src/orm'
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

let pgOrm = new Orm(schema, 'postgres')
let table1 = schema.getTable('table1')
let table2 = schema.getTable('table2')

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
    it('insert simple object', async function() {
      let obj1 = {
        property1: 'a'
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('insert many-to-one primary key generated', async function() {
      let obj1 = {
        property1: 'a',
        manyToOneObject1: {
          property1: 'b'
        }
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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


    it('insert many-to-one primary key not generated', async function() {
      let obj1 = {
        property1: 'a',
        manyToOneObject2: {
          id: 'x',
          property1: 'b'
        }
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('insert one-to-one primary key generated', async function() {
      let obj1 = {
        property1: 'a',
        oneToOneObject1: {
          property1: 'b'
        }
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('insert one-to-one primary key generated references back', async function() {
      let obj1 = {
        property1: 'a',
        oneToOneObject1: {
          property1: 'b',
          oneToOneObject1: {}
        }
      }

      obj1.oneToOneObject1.oneToOneObject1 = obj1

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('insert one-to-one references the same entity', async function() {
      let obj1 = {
        property1: 'a',
        oneToOneObject1: {}
      }

      obj1.oneToOneObject1 = obj1

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)
      
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

    it('insert one-to-one primary key not generated', async function() {
      let obj1 = {
        property1: 'a',
        oneToOneObject2: {
          id: 'x',
          property1: 'b'
        }
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('insert one-to-one primary key not generated references back', async function() {
      let obj1 = {
        property1: 'a',
        oneToOneObject2: {
          id: 'x',
          property1: 'b',
          oneToOneObject1: {}
        }
      }

      obj1.oneToOneObject2.oneToOneObject1 = obj1

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('insert one-to-many primary key generated', async function() {
      let obj1 = {
        property1: 'a',
        oneToManyObject1: [
          {
            property1: 'b'
          },
          {
            property1: 'c'
          }
        ]
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('insert one-to-many primary key generated references back', async function() {
      let obj1 = {
        property1: 'a',
        oneToManyObject1: [
          {
            property1: 'b',
            oneToManyObject1ManyToOne: {}
          },
          {
            property1: 'c',
            oneToManyObject1ManyToOne: {}
          }
        ]
      }

      obj1.oneToManyObject1[0].oneToManyObject1ManyToOne = obj1
      obj1.oneToManyObject1[1].oneToManyObject1ManyToOne = obj1
      
      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('insert one-to-many primary key not generated', async function() {
      let obj1 = {
        property1: 'a',
        oneToManyObject2: [
          {
            id: 'x',
            property1: 'b'
          },
          {
            id: 'y',
            property1: 'c'
          }
        ]
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('insert one-to-many primary key not generated references back', async function() {
      let obj1 = {
        property1: 'a',
        oneToManyObject2: [
          {
            id: 'x',
            property1: 'b',
            oneToManyObject2ManyToOne: {}
          },
          {
            id: 'y',
            property1: 'c',
            oneToManyObject2ManyToOne: {}
          }
        ]
      }

      obj1.oneToManyObject2[0].oneToManyObject2ManyToOne = obj1
      obj1.oneToManyObject2[1].oneToManyObject2ManyToOne = obj1

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('insert one-to-many references same entity', async function() {
      let obj1 = {
        property1: 'a',
        oneToManyObject1: null
      } as any

      obj1.oneToManyObject1 = [ obj1 ]

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false
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
        one_to_many_object1_many_to_one_id: 1
      })
    })

    it('insert many-to-many primary key generated', async function() {
      let obj1 = {
        property1: 'a',
        manyToManyObject1: [
          {
            property1: 'b',
            object12: {
              property1: 'c'
            }
          },
          {
            property1: 'd',
            object12: {
              property1: 'e'
            }
          }
        ]
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject1: [
          {
            object11Id: 1,
            object12Id: 2,
            '@update': false,
            object12: {
              id: 2,
              '@update': false,
            }
          },
          {
            object11Id: 1,
            object12Id: 3,
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

    it('insert many-to-many primary key generated references back', async function() {
      let obj1 = {
        property1: 'a',
        manyToManyObject1: [
          {
            property1: 'b',
            object11: {},
            object12: {
              property1: 'c',
              manyToManyObject1: []
            } as any
          },
          {
            property1: 'd',
            object11: {},
            object12: {
              property1: 'e',
              manyToManyObject1: []
            }
          }
        ]
      }

      obj1.manyToManyObject1[0].object11 = obj1
      obj1.manyToManyObject1[0].object12.manyToManyObject1.push(obj1.manyToManyObject1[0])
      obj1.manyToManyObject1[1].object11 = obj1
      obj1.manyToManyObject1[1].object12.manyToManyObject1.push(obj1.manyToManyObject1[1])

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject1: [
          {
            object11Id: 1,
            object12Id: 2,
            '@update': false,
            object12: {
              id: 2,
              '@update': false
            }
          },
          {
            object11Id: 1,
            object12Id: 3,
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

    it('insert many-to-many references the same entity', async function() {
      let obj1 = {
        property1: 'a',
        manyToManyObject1: [
          {
            property1: 'b',
            object12: {}
          }
        ]
      }

      obj1.manyToManyObject1[0].object12 = obj1

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject1: [
          {
            object11Id: 1,
            object12Id: 1,
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

    it('insert many-to-many primary key not generated', async function() {
      let obj1 = {
        property1: 'a',
        manyToManyObject2: [
          {
            property1: 'b',
            object2: {
              id: 'x',
              property1: 'c'
            }
          },
          {
            property1: 'd',
            object2: {
              id: 'y',
              property1: 'e'
            }
          }
        ]
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject2: [
          {
            object1Id: 1,
            object2Id: 'x',
            '@update': false,
            object2: {
              id: 'x',
              '@update': false,
            }
          },
          {
            object1Id: 1,
            object2Id: 'y',
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

    it('insert many-to-many primary key not generated references back', async function() {
      let obj1 = {
        property1: 'a',
        manyToManyObject2: [
          {
            property1: 'b',
            object1: {},
            object2: {
              id: 'x',
              property1: 'c',
              manyToManyObject2: []
            } as any
          },
          {
            property1: 'd',
            object1: {},
            object2: {
              id: 'y',
              property1: 'e',
              manyToManyObject2: []
            }
          }
        ]
      }

      obj1.manyToManyObject2[0].object1 = obj1
      obj1.manyToManyObject2[0].object2.manyToManyObject2.push(obj1.manyToManyObject2[0])
      obj1.manyToManyObject2[1].object1 = obj1
      obj1.manyToManyObject2[1].object2.manyToManyObject2.push(obj1.manyToManyObject2[1])

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject2: [
          {
            object1Id: 1,
            object2Id: 'x',
            '@update': false,
            object2: {
              id: 'x',
              '@update': false
            }
          },
          {
            object1Id: 1,
            object2Id: 'y',
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

    it('update simple obj', async function() {
      await pgQueryFn('INSERT INTO table1 (column1) VALUES ($1)', ['a'])

      let obj1 = {
        id: 1,
        property1: 'b'
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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

    it('update many-to-one primary key not generated', async function() {
      await pgQueryFn('INSERT INTO table1 (column1) VALUES ($1)', ['a'])
      await pgQueryFn('INSERT INTO table2 (id, column1) VALUES ($1, $2)', ['x', 'b'])

      let obj1 = {
        id: 1,
        property1: 'b',
        manyToOneObject2: {
          id: 'x',
          property1: 'c'
        }
      }

      let storeInfo = await pgOrm.store(pgQueryFn, table1, obj1)

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
      await pgQueryFn('INSERT INTO table1 (property1) VALUES ($1)', ['a'])
      await pgQueryFn('INSERT INTO table1 (property1) VALUES ($1)', ['b'])

      let result = await pgOrm.delete(pgQueryFn, table1, { id: 1 }, true)

      expect(result).to.deep.equal({
        id: 1
      })

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result.rows[0]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })
    })

    it('should not delete anything if the primary key is missing', async function() {
      await pgQueryFn('INSERT INTO table1 (property1) VALUES ($1)', ['a'])
      await pgQueryFn('INSERT INTO table1 (property1) VALUES ($1)', ['b'])

      expect(pgOrm.delete(pgQueryFn, table1, { }, true)).to.be.rejectedWith('Could not delete object because the primary key is not set.')

      let table1Result = await pgQueryFn('SELECT * FROM table1 ORDER BY id')

      expect(table1Result.rows.length).to.equal(2)
      expect(table1Result.rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })

      expect(table1Result.rows[1]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })
    })
  })

  describe('load', function() {
    it('should load all rows', async function() {
      let date1 = new Date
      let date2 = new Date
      let date3 = new Date
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', property2: 1, property3: date1 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'b', property2: 2, property3: date2 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await pgOrm.load(pgQueryFn, table1, {})

      expect(rows.length).to.equal(3)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        property3: date1,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(rows[1]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: 2,
        property3: date2,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(rows[2]).to.deep.equal({
        id: 3,
        property1: 'c',
        property2: 3,
        property3: date3,
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
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', property2: 1, property3: date1 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'b', property2: 2, property3: date2 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await pgOrm.load(pgQueryFn, table1, {
        '@orderBy': {
          field: 'property2',
          direction: 'DESC'
        }
      }, true)

      expect(rows.length).to.equal(3)
      
      expect(rows[0]).to.deep.equal({
        id: 3,
        property1: 'c',
        property2: 3,
        property3: date3,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(rows[1]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: 2,
        property3: date2,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(rows[2]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        property3: date1,
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
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', property2: 1, property3: date1 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'b', property2: 2, property3: date2 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await pgOrm.load(pgQueryFn, table1, {
        '@limit': 2
      }, true)

      expect(rows.length).to.equal(2)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        property3: date1,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(rows[1]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: 2,
        property3: date2,
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
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', property2: 1, property3: date1 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'b', property2: 2, property3: date2 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await pgOrm.load(pgQueryFn, table1, {
        '@offset': 2
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 3,
        property1: 'c',
        property2: 3,
        property3: date3,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should regard criteria in a many-to-one relationship', async function() {
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 1 }})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 2 }})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 3 }})

      let rows = await pgOrm.load(pgQueryFn, table1, {
        property1: 'a',
        manyToOneObject1: {
          property2: 1
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should regard criteria in a many-to-one relationship regarding the id', async function() {
      await pgOrm.store(pgQueryFn, table1, { manyToOneObject1: { }})
      await pgOrm.store(pgQueryFn, table1, { manyToOneObject1: { }})
      await pgOrm.store(pgQueryFn, table1, { manyToOneObject1: { }})

      let rows = await pgOrm.load(pgQueryFn, table1, {
        manyToOneObject1: {
          id: 1
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: null,
        property2: null,
        property3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should regard criteria in a many-to-one relationship and load it', async function() {
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 1 }})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 2 }})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 3 }})

      let rows = await pgOrm.load(pgQueryFn, table1, {
        property1: 'a',
        manyToOneObject1: {
          '@load': true,
          property2: 1
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 1,
          property1: null,
          property2: 1,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }
      })
    })

    it('should load a many-to-one relationship separately', async function() {
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 1 }})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 2 }})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 3 }})

      let rows = await pgOrm.load(pgQueryFn, table1, {
        property1: 'a',
        manyToOneObject1: {
          '@loadSeparately': true,
          property2: 1
        }
      }, true)

      expect(rows.length).to.equal(3)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 1,
          property1: null,
          property2: 1,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }
      })

      expect(rows[1]).to.deep.equal({
        id: 4,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 3,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: null
      })

      expect(rows[2]).to.deep.equal({
        id: 6,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 5,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: null
      })
    })

    it('should regard criteria in a one-to-many relationship', async function() {
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await pgOrm.load(pgQueryFn, table1, {
        property1: 'a',
        oneToManyObject1: {
          property1: 'd'
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should regard criteria in a one-to-many relationship and load it', async function() {
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await pgOrm.load(pgQueryFn, table1, {
        property1: 'a',
        oneToManyObject1: {
          '@load': true,
          property1: 'd'
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject1: [
          {
            id: 2,
            property1: 'd',
            property2: null,
            property3: null,
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
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await pgOrm.load(pgQueryFn, table1, {
        property1: 'a',
        oneToManyObject1: {
          '@loadSeparately': true,
          property1: 'd'
        }
      }, true)

      expect(rows.length).to.equal(3)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject1: [
          {
            id: 2,
            property1: 'd',
            property2: null,
            property3: null,
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
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject1: []
      })

      expect(rows[2]).to.deep.equal({
        id: 7,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject1: []
      })
    })

    it('should process criteria given as array', async function() {
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 1 }, oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 2 }, oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', manyToOneObject1: { property2: 3 }, oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await pgOrm.load(pgQueryFn, table1, [
        {
          property1: 'a',
          manyToOneObject1: {
            '@load': true,
            property2: 1
          }
        },
        'OR',
        {
          property1: 'a',
          oneToManyObject1: {
            '@loadSeparately': true,
            property1: 'd'
          }
        }
      ], true)

      expect(rows.length).to.equal(3)
      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 1,
          property1: null,
          property2: 1,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        },
        oneToManyObject1: [
          {
            id: 3,
            property1: 'd',
            property2: null,
            property3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: 2
          }
        ]
      })

      expect(rows[1]).to.deep.equal({
        id: 6,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 5,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 5,
          property1: null,
          property2: 2,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        },
        oneToManyObject1: []
      })

      expect(rows[2]).to.deep.equal({
        id: 10,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 9,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 9,
          property1: null,
          property2: 3,
          property3: null,
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

      let rows = await pgOrm.load(pgQueryFn, table2, {}, true)

      expect(rows.length).to.equal(0)
    })
  })

  describe('criteriaDelete', function() {
    it('should delete a simple obj1 by id', async function() {
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', property2: 1 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'b', property2: 2 })

      let deletedRows = await pgOrm.criteriaDelete(pgQueryFn, table1, { id: 1 }, true)

      expect(deletedRows).to.deep.equal([{
        id: 1,
        property1: 'a',
        property2: 1,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      }])

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result).to.deep.equal([{
        id: 2,
        property1: 'b',
        property2: 2,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      }])
    })

    it('should delete a simple obj1 by another column than the id', async function() {
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', property2: 1 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'b', property2: 2 })

      let deletedRows = await pgOrm.criteriaDelete(pgQueryFn, table1, { property1: 'a' }, true)

      expect(deletedRows).to.deep.equal([{
        id: 1,
        property1: 'a',
        property2: 1,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      }])

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result).to.deep.equal([{
        id: 2,
        property1: 'b',
        property2: 2,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      }])
    })

    it('should not delete anything if the criteria contained invalid columns', async function() {
      await pgOrm.store(pgQueryFn, table1, { property1: 'a', property2: 1 })
      await pgOrm.store(pgQueryFn, table1, { property1: 'b', property2: 2 })

      expect(pgOrm.criteriaDelete(pgQueryFn, table1, { invalid: 'invalid' }, true)).to.be.rejectedWith(Error)

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(2)
      expect(table1Result).to.deep.equal([
        {
          id: 1,
          property1: 'a',
          property2: 1,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
          },
        {
          id: 2,
          property1: 'b',
          property2: 2,
          property3: null,
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
