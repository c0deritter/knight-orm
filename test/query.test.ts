import { expect } from 'chai'
import { Join, Query } from 'knight-sql'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { Orm } from '../src'
import { QueryTools } from '../src/query'
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

let queryTools = new QueryTools(new Orm(schema, 'postgres'))

class TestCriteria {
  column1 = 'a'
}

class TestSubCriteria extends TestCriteria {
  column2 = 1
}

class TestPropertyMethods {
  get column1() { return 'a' }
  get column2() { return 1 }
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

        let result = await queryTools.databaseIndependentQuery(pgQueryFn, 'SELECT * FROM table1 ORDER BY id')

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
        let result = await queryTools.databaseIndependentQuery(pgQueryFn, 'INSERT INTO table2 (id, column1) VALUES ($1, $2)', ['x', 'a'])

        expect(result).to.deep.equal({
          affectedRows: 1
        })
      })

      it('should insert a row and return the generated id', async function() {
        let result = await queryTools.databaseIndependentQuery(pgQueryFn, 'INSERT INTO table1 (column1) VALUES ($1)', ['a'], 'id')

        expect(result).to.deep.equal({
          affectedRows: 1,
          insertId: 1
        })
      })

      it('should update rows', async function() {
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')

        let result = await queryTools.databaseIndependentQuery(pgQueryFn, 'UPDATE table1 SET column1=$1', ['a'])

        expect(result).to.deep.equal({
          affectedRows: 3
        })
      })

      it('should delete rows', async function() {
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')
        await pgQueryFn('INSERT INTO table1 DEFAULT VALUES')

        let result = await queryTools.databaseIndependentQuery(pgQueryFn, 'DELETE FROM table1')

        expect(result).to.deep.equal({
          affectedRows: 3
        })
      })
    })
  })

  describe('addCriteria', function() {
    it('should add a simple equals comparison', function() {
      let criteria = {
        column1: 'a'
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
  
      expect(query._where!.mysql()).to.equal('table1.column1 = ?')
      expect(query._where!.values()).to.deep.equal(['a'])
    })
  
    it('should add two simple equals comparisons which are AND connected', function() {
      let criteria = {
        column1: 'a',
        column2: 1
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
  
      expect(query._where!.mysql()).to.equal('table1.column1 = ? AND table1.column2 = ?')
      expect(query._where!.values()).to.deep.equal(['a',1])
    })
  
    it('should add a NOT negating a criteria object', function() {
      let criteria = {
        '@not': true,
        column1: 'a',
        column2: 1
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
  
      expect(query._where!.mysql()).to.equal('NOT (table1.column1 = ? AND table1.column2 = ?)')
      expect(query._where!.values()).to.deep.equal(['a',1])
    })
  
    it('should add a comparison', function() {
      let criteria = {
        column1: {
          '@operator': '<>',
          '@value': 'a'
        }
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('table1.column1 <> ?')
      expect(query._where!.values()).to.deep.equal(['a'])
    })
  
    it('should add a comparison with not', function() {
      let criteria = {
        column1: {
          '@not': true,
          '@operator': '<>',
          '@value': 'a'
        }
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('NOT table1.column1 <> ?')
      expect(query._where!.values()).to.deep.equal(['a'])
    })
  
    it('should add a simple comparison and a comparison object', function() {
      let criteria1 = {
        column1: {
          '@operator': '<>',
          '@value': 'a'
        },
        column2: 1
      }
  
      let query1 = new Query
      queryTools.addCriteria(schema.getTable('table1'), query1, criteria1, true)
      
      expect(query1._where!.mysql()).to.equal('table1.column1 <> ? AND table1.column2 = ?')
      expect(query1._where!.values()).to.deep.equal(['a',1])

      let criteria2 = {
        column1: 'a',
        column2: {
          '@operator': '<>',
          '@value': 1
        }
      }
  
      let query2 = new Query
      queryTools.addCriteria(schema.getTable('table1'), query2, criteria2, true)
      
      expect(query2._where!.mysql()).to.equal('table1.column1 = ? AND table1.column2 <> ?')
      expect(query2._where!.values()).to.deep.equal(['a',1])
    })
  
    it('should not add a comparison if the operator is not supported', function() {
      let criteria = {
        column1: {
          '@operator': '; DELETE FROM table1;',
          '@value': 'a'
        }
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('')
      expect(query._where!.values()).to.deep.equal([])
    })
  
    it('should not add a property and value citerium if the value is undefined', function() {
      let criteria = {
        column1: {
          '@operator': '<>',
          '@value': undefined
        }
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('')
    })

    it('should add a null criterium', function() {
      let criteria1 = {
        column1: null
      }
  
      let query1 = new Query
      queryTools.addCriteria(schema.getTable('table1'), query1, criteria1, true)
  
      expect(query1._where!.mysql()).to.equal('table1.column1 IS NULL')
      expect(query1._where!.values()).to.deep.equal([])
  
      let criteria2 = {
        column1: {
          '@operator': '=',
          '@value': null
        }
      }
  
      let query2 = new Query
      queryTools.addCriteria(schema.getTable('table1'), query2, criteria2, true)
      
      expect(query2._where!.mysql()).to.equal('table1.column1 IS NULL')
      expect(query2._where!.values()).to.deep.equal([])

      let criteria3 = {
        column1: {
          '@operator': '!=',
          '@value': null
        }
      }
  
      let query3 = new Query
      queryTools.addCriteria(schema.getTable('table1'), query3, criteria3, true)
      
      expect(query3._where!.mysql()).to.equal('table1.column1 IS NOT NULL')
      expect(query3._where!.values()).to.deep.equal([])

      let criteria4 = {
        column1: {
          '@operator': '<>',
          '@value': null
        }
      }
  
      let query4 = new Query
      queryTools.addCriteria(schema.getTable('table1'), query4, criteria4, true)
      
      expect(query4._where!.mysql()).to.equal('table1.column1 IS NOT NULL')
      expect(query4._where!.values()).to.deep.equal([])
    })
  
    it('should create an IN operator of an array of values', function() {
      let criteria1 = {
        column1: [1, 2, 3, 4]
      }
  
      let query1 = new Query
      queryTools.addCriteria(schema.getTable('table1'), query1, criteria1, true)
      
      expect(query1._where!.mysql()).to.equal('table1.column1 IN (?, ?, ?, ?)')
      expect(query1._where!.values()).to.deep.equal([1,2,3,4])

      let criteria2 = {
        column1: ['a', 'b', 'c', 'd']
      }
  
      let query2 = new Query
      queryTools.addCriteria(schema.getTable('table1'), query2, criteria2, true)
      
      expect(query2._where!.mysql()).to.equal('table1.column1 IN (?, ?, ?, ?)')
      expect(query2._where!.values()).to.deep.equal(['a', 'b', 'c', 'd'])
  
      let date1 = new Date
      let date2 = new Date
  
      let criteria3 = {
        column1: [date1, date2]
      }
  
      let query3 = new Query
      queryTools.addCriteria(schema.getTable('table1'), query3, criteria3, true)
      
      expect(query3._where!.mysql()).to.equal('table1.column1 IN (?, ?)')
      expect(query3._where!.values()).to.deep.equal([date1, date2])
    })

    it('should accept an array of comparisons', function() {
      let criteria = {
        column2: [
          {
            '@operator': '<',
            '@value': 1
          },
          {
            '@not': true,
            '@operator': '>',
            '@value': 10
          }
        ]
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('(table1.column2 < ? OR NOT table1.column2 > ?)')
      expect(query._where!.values()).to.deep.equal([1, 10])
    })
  
    it('should add an array of one comparison', function() {
      let criteria = {
        column2: [
          {
            '@operator': '<',
            '@value': 1
          }
        ]
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('(table1.column2 < ?)')
      expect(query._where!.values()).to.deep.equal([1])
    })
  
    it('should not add an array of one comparison if the operator is not supported', function() {
      let criteria = {
        column2: [
          {
            '@operator': '; DELETE FROM table1;',
            '@value': 1
          }
        ]
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('')
      expect(query._where!.values()).to.deep.equal([])
    })
  
    it('should accept an array of comparisons and ignore those which values are undefined', function() {
      let criteria = {
        column2: [
          {
            '@operator': '>',
            '@value': undefined
          },
          {
            '@operator': '<',
            '@value': 1
          },
          {
            '@operator': '>',
            '@value': undefined
          }
        ]
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('(table1.column2 < ?)')
      expect(query._where!.values()).to.deep.equal([1])
    })
  
    it('should accept an array comparisons which values are undefined', function() {
      let criteria = {
        column2: [
          {
            '@operator': '>',
            '@value': undefined
          },
          {
            '@operator': '>',
            '@value': undefined
          }
        ]
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('')
      expect(query._where!.values()).to.deep.equal([])
    })

    it('should set an empty array as always being false', function() {
      let criteria = {
        column1: []
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
  
      expect(query._where!.mysql()).to.equal('1 = 2')
      expect(query._where!.values()).to.deep.equal([])
    })
  
    it('should accept an array of comparisons which value is an empty array', function() {
      let criteria = {
        column2: [
          {
            '@operator': '=',
            '@value': []
          },
          {
            '@operator': 'IN',
            '@value': []
          },
          {
            '@operator': '!=',
            '@value': []
          },
          {
            '@operator': '<>',
            '@value': []
          },
          {
            '@operator': 'NOT IN',
            '@value': []
          },
          {
            '@not': true,
            '@operator': 'IN',
            '@value': []
          },
        ]
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('(1 = 2 OR 1 = 2 OR 1 = 1 OR 1 = 1 OR 1 = 1 OR NOT 1 = 2)')
      expect(query._where!.values()).to.deep.equal([])
    })
  
    it('should accept an array of comparisons which are AND connected', function() {
      let criteria = {
        column2: [
          'AND',
          {
            '@operator': '>',
            '@value': 1
          },
          'AND',
          {
            '@not': true,
            '@operator': '<',
            '@value': 10
          },
          'AND'
        ]
      }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('(table1.column2 > ? AND NOT table1.column2 < ?)')
      expect(query._where!.values()).to.deep.equal([1, 10])
    })

    it('should regard inherited properties', function() {
      let criteria = new TestSubCriteria
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
  
      expect(query._where!.mysql()).to.equal('table1.column1 = ? AND table1.column2 = ?')
      expect(query._where!.values()).to.deep.equal(['a', 1])
    })
  
    it('should regard property methods', function() {
      let criteria = new TestPropertyMethods
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
  
      expect(query._where!.mysql()).to.equal('table1.column1 = ? AND table1.column2 = ?')
      expect(query._where!.values()).to.deep.equal(['a', 1])
    })
  
    it('should add Date comparisons', function() {
      let now = new Date
      let criteria = { column1: now }
  
      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)
  
      expect(query._where!.mysql()).to.equal('table1.column1 = ?')
      expect(query._where!.values()).to.deep.equal([now])
    })

    it('should join criteria for a relationship', function() {
      let criteria = {
        manyToManyObject2: {
          column1: 'a'
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._join!.pieces!.length).to.equal(1)
      expect((query._join!.pieces![0] as Join).type).to.equal('LEFT')
      expect((query._join!.pieces![0] as Join).table).to.equal('many_to_many_table2')
      expect((query._join!.pieces![0] as Join).alias).to.equal('table1__manyToManyObject2')
      expect((query._join!.pieces![0] as Join).on).to.equal('table1.id = table1__manyToManyObject2.table1_id')
      expect(query._where!.mysql()).to.equal('table1__manyToManyObject2.column1 = ?')
      expect(query._where!.values()).to.deep.equal(['a'])
    })

    it('should join criteria for a relationship if it is to load', function() {
      let criteria = {
        manyToManyObject2: {
          '@load': true,
          column1: 'a'
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._join!.pieces!.length).to.equal(1)
      expect((query._join!.pieces![0] as Join).type).to.equal('LEFT')
      expect((query._join!.pieces![0] as Join).table).to.equal('many_to_many_table2')
      expect((query._join!.pieces![0] as Join).alias).to.equal('table1__manyToManyObject2')
      expect((query._join!.pieces![0] as Join).on).to.equal('table1.id = table1__manyToManyObject2.table1_id')
      expect(query._where!.mysql()).to.equal('table1__manyToManyObject2.column1 = ?')
      expect(query._where!.values()).to.deep.equal(['a'])
    })

    it('should not join criteria for a relationship if it is to load with new query', function() {
      let criteria = {
        manyToManyObject2: {
          '@loadSeparately': true,
          column1: 'a'
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._join).to.be.undefined
      expect(query._where!.sql('mysql')).to.equal('')
    })

    it('should join criteria for a relationship of a relationship', function() {
      let criteria = {
        manyToManyObject2: {
          column1: 'a',
          object1: {
            column1: 'b'
          }
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._join!.pieces!.length).to.equal(2)
      expect((query._join!.pieces![0] as Join).type).to.equal('LEFT')
      expect((query._join!.pieces![0] as Join).table).to.equal('many_to_many_table2')
      expect((query._join!.pieces![0] as Join).alias).to.equal('table1__manyToManyObject2')
      expect((query._join!.pieces![0] as Join).on).to.equal('table1.id = table1__manyToManyObject2.table1_id')
      expect((query._join!.pieces![1] as Join).type).to.equal('LEFT')
      expect((query._join!.pieces![1] as Join).table).to.equal('table1')
      expect((query._join!.pieces![1] as Join).alias).to.equal('table1__manyToManyObject2__object1')
      expect((query._join!.pieces![1] as Join).on).to.equal('table1__manyToManyObject2.table1_id = table1__manyToManyObject2__object1.id')
      expect(query._where!.mysql()).to.equal('table1__manyToManyObject2.column1 = ? AND table1__manyToManyObject2__object1.column1 = ?')
      expect(query._where!.values()).to.deep.equal(['a','b'])
    })

    it('should not join criteria for a relationship of a relationship', function() {
      let criteria = {
        manyToManyObject2: {
          column1: 'a',
          object1: {
            '@loadSeparately': true,
            column1: 'b'
          }
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._join!.pieces!.length).to.equal(1)
      expect((query._join!.pieces![0] as Join).type).to.equal('LEFT')
      expect((query._join!.pieces![0] as Join).table).to.equal('many_to_many_table2')
      expect((query._join!.pieces![0] as Join).alias).to.equal('table1__manyToManyObject2')
      expect((query._join!.pieces![0] as Join).on).to.equal('table1.id = table1__manyToManyObject2.table1_id')
      expect(query._where!.mysql()).to.equal('table1__manyToManyObject2.column1 = ?')
      expect(query._where!.values()).to.deep.equal(['a'])
    })

    it('should accept a criteria array', function() {
      let criteria = [
        'AND',
        {
          column1: 'a',
          column2: 1
        },
        'XOR',
        {
          column1: 'b',
          column2: 2
        },
        'OR'
      ]

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._where!.mysql()).to.equal('(table1.column1 = ? AND table1.column2 = ?) XOR (table1.column1 = ? AND table1.column2 = ?)')
      expect(query._where!.values()).to.deep.equal(['a',1,'b',2])
    })

    it('should accept an criteria array inside an criteria array', function() {
      let criteria = [
        {
          column1: 'a',
          column2: 1
        },
        'XOR',
        [
          {
            column1: 'b',
            column2: 2
          },
          {
            column1: 'c',
            column2: 3
          }
        ]
      ]

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._where!.mysql()).to.equal('(table1.column1 = ? AND table1.column2 = ?) XOR ((table1.column1 = ? AND table1.column2 = ?) OR (table1.column1 = ? AND table1.column2 = ?))')
      expect(query._where!.values()).to.deep.equal(['a',1,'b',2,'c',3])
    })

    it('should join a table for the same property only once', function() {
      let criteria = [
        {
          manyToOneObject2: {
            column1: 'a'
          }
        },
        {
          manyToOneObject2: {
            column1: 'b'
          }
        }
      ]

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._join!.pieces!.length).to.equal(1)
      expect(query._join!.pieces![0]).to.deep.equal({
        type: 'LEFT',
        table: 'table2',
        alias: 'table1__manyToOneObject2',
        on: 'table1.many_to_one_object2_id = table1__manyToOneObject2.id'
      })
      expect(query._where!.mysql()).to.equal('(table1__manyToOneObject2.column1 = ?) OR (table1__manyToOneObject2.column1 = ?)')
      expect(query._where!.values()).to.deep.equal(['a','b'])
    })

    it('should add an order by condition', function() {
      let criteria = {
        '@orderBy': 'column1'
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1')
    })

    it('should not add an order by condition if the column is invalid', function() {
      let criteria = {
        '@orderBy': 'column4'
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.undefined
    })

    it('should alias an order by condition in case of a relationship', function() {
      let criteria = {
        '@orderBy': 'column1',
        manyToManyObject2: {
          '@orderBy': 'column1'
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1, table1__manyToManyObject2.column1')
    })

    it('should add multiple order by conditions', function() {
      let criteria = {
        '@orderBy': ['column1', 'column2']
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1, table1.column2')
    })

    it('should alias multiple order by conditions in case of a relationship', function() {
      let criteria = {
        '@orderBy': ['column1', 'column2'],
        manyToManyObject2: {
          '@orderBy': ['column1']
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1, table1.column2, table1__manyToManyObject2.column1')
    })

    it('should not add multiple order by conditions if they are invalid', function() {
      let criteria = {
        '@orderBy': ['column4', 'column5']
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.undefined
    })

    it('should add an order by condition with a given direction', function() {
      let criteria = {
        '@orderBy': {
          field: 'column1',
          direction: 'DESC'
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1 DESC')
    })

    it('should alias an order by condition with a given direction in case of a relationship', function() {
      let criteria = {
        '@orderBy': {
          field: 'column1',
          direction: 'DESC'
        },
        manyToManyObject2: {
          '@orderBy': {
            field: 'column1',
            direction: 'ASC'
          }
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1 DESC, table1__manyToManyObject2.column1 ASC')
    })

    it('should not add an order by condition with a given direction if the column is invalid', function() {
      let criteria = {
        '@orderBy': {
          field: 'column4',
          direction: 'DESC'
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.undefined
    })

    it('should add multiple order by conditions with a given direction', function() {
      let criteria = {
        '@orderBy': [
          {
            field: 'column1',
            direction: 'DESC'
          },
          {
            field: 'column2',
            direction: 'ASC'
          }
        ]
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1 DESC, table1.column2 ASC')
    })

    it('should alias multiple order by conditions with a given direction in case of a relationship', function() {
      let criteria = {
        '@orderBy': [
          {
            field: 'column1',
            direction: 'DESC'
          },
          {
            field: 'column2',
            direction: 'ASC'
          }
        ],
        manyToManyObject2: {
          '@orderBy': [
            {
              field: 'column1',
              direction: 'ASC'
            }
          ]
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1 DESC, table1.column2 ASC, table1__manyToManyObject2.column1 ASC')
    })

    it('should not add multiple order by conditions with a given direction if the columns are invalid', function() {
      let criteria = {
        '@orderBy': [
          {
            field: 'column4',
            direction: 'DESC'
          },
          {
            field: 'column5',
            direction: 'ASC'
          }
        ]
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.undefined
    })

    it('should set a limit', function() {
      let criteria = {
        '@limit': 10
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._limit).to.equal(10)
    })

    it('should not overwrite an already existing limit', function() {
      let criteria = {
        '@limit': 10
      }

      let query = new Query
      query.limit(5)
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._limit).to.equal(5)
    })

    it('should not overwrite with a limit given in relationship criteria', function() {
      let criteria = {
        '@limit': 10,
        manyToManyObject2: {
          '@limit': 15
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._limit).to.equal(10)
    })

    it('should set an offset', function() {
      let criteria = {
        '@offset': 10
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._offset).to.equal(10)
    })

    it('should not overwrite an already existing offset', function() {
      let criteria = {
        '@offset': 10
      }

      let query = new Query
      query.offset(5)
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._offset).to.equal(5)
    })

    it('should not overwrite with an offset given in relationship criteria', function() {
      let criteria = {
        '@offset': 10,
        manyToManyObject2: {
          '@offset': 15
        }
      }

      let query = new Query
      queryTools.addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._offset).to.equal(10)
    })
  })

  describe('buildCriteriaReadQuery', function() {
    it('should handle a simple select query', function() {
      let criteria = { column1: 'a', column2: 1 }
      let query = queryTools.buildCriteriaReadQuery(schema.getTable('table1'), criteria, true)
      expect(query.mysql()).to.equal('SELECT table1.id "table1__id", table1.column1 "table1__column1", table1.column2 "table1__column2", table1.column3 "table1__column3", table1.many_to_one_object1_id "table1__many_to_one_object1_id", table1.many_to_one_object2_id "table1__many_to_one_object2_id", table1.one_to_one_object1_id "table1__one_to_one_object1_id", table1.one_to_one_object2_id "table1__one_to_one_object2_id", table1.one_to_many_object1_many_to_one_id "table1__one_to_many_object1_many_to_one_id" FROM table1 table1 WHERE table1.column1 = ? AND table1.column2 = ?')
    })
  
    it('should handle inter table relationships', function() {
      let criteria = {
        id: 1,
        column1: 'a',
        manyToManyObject2: {
          '@load': true,
          column1: 'b',
          object2: {
            '@load': true,
            column1: 'c'
          }
        }
      }
  
      let query = queryTools.buildCriteriaReadQuery(schema.getTable('table1'), criteria, true)
  
      expect(query._select!.pieces!.length).to.equal(20)
      expect(query._select!.pieces![0]).to.equal('table1.id "table1__id"')
      expect(query._select!.pieces![1]).to.equal('table1.column1 "table1__column1"')
      expect(query._select!.pieces![2]).to.equal('table1.column2 "table1__column2"')
      expect(query._select!.pieces![3]).to.equal('table1.column3 "table1__column3"')
      expect(query._select!.pieces![4]).to.equal('table1.many_to_one_object1_id "table1__many_to_one_object1_id"')
      expect(query._select!.pieces![5]).to.equal('table1.many_to_one_object2_id "table1__many_to_one_object2_id"')
      expect(query._select!.pieces![6]).to.equal('table1.one_to_one_object1_id "table1__one_to_one_object1_id"')
      expect(query._select!.pieces![7]).to.equal('table1.one_to_one_object2_id "table1__one_to_one_object2_id"')
      expect(query._select!.pieces![8]).to.equal('table1.one_to_many_object1_many_to_one_id "table1__one_to_many_object1_many_to_one_id"')
      expect(query._select!.pieces![9]).to.equal('table1__manyToManyObject2.table1_id "table1__manyToManyObject2__table1_id"')
      expect(query._select!.pieces![10]).to.equal('table1__manyToManyObject2.table2_id "table1__manyToManyObject2__table2_id"')
      expect(query._select!.pieces![11]).to.equal('table1__manyToManyObject2.column1 "table1__manyToManyObject2__column1"')
      expect(query._select!.pieces![12]).to.equal('table1__manyToManyObject2.column2 "table1__manyToManyObject2__column2"')
      expect(query._select!.pieces![13]).to.equal('table1__manyToManyObject2.column3 "table1__manyToManyObject2__column3"')
      expect(query._select!.pieces![14]).to.equal('table1__manyToManyObject2__object2.id "table1__manyToManyObject2__object2__id"')
      expect(query._select!.pieces![15]).to.equal('table1__manyToManyObject2__object2.column1 "table1__manyToManyObject2__object2__column1"')
      expect(query._select!.pieces![16]).to.equal('table1__manyToManyObject2__object2.column2 "table1__manyToManyObject2__object2__column2"')
      expect(query._select!.pieces![17]).to.equal('table1__manyToManyObject2__object2.column3 "table1__manyToManyObject2__object2__column3"')
      expect(query._select!.pieces![18]).to.equal('table1__manyToManyObject2__object2.one_to_one_object1_id "table1__manyToManyObject2__object2__one_to_one_object1_id"')
      expect(query._select!.pieces![19]).to.equal('table1__manyToManyObject2__object2.one_to_many_object2_many_to_one_id "table1__manyToManyObject2__object2__one_to_many_object2_many_to_one_id"')
  
      expect(query.mysql()).to.equal('SELECT table1.id "table1__id", table1.column1 "table1__column1", table1.column2 "table1__column2", table1.column3 "table1__column3", table1.many_to_one_object1_id "table1__many_to_one_object1_id", table1.many_to_one_object2_id "table1__many_to_one_object2_id", table1.one_to_one_object1_id "table1__one_to_one_object1_id", table1.one_to_one_object2_id "table1__one_to_one_object2_id", table1.one_to_many_object1_many_to_one_id "table1__one_to_many_object1_many_to_one_id", table1__manyToManyObject2.table1_id "table1__manyToManyObject2__table1_id", table1__manyToManyObject2.table2_id "table1__manyToManyObject2__table2_id", table1__manyToManyObject2.column1 "table1__manyToManyObject2__column1", table1__manyToManyObject2.column2 "table1__manyToManyObject2__column2", table1__manyToManyObject2.column3 "table1__manyToManyObject2__column3", table1__manyToManyObject2__object2.id "table1__manyToManyObject2__object2__id", table1__manyToManyObject2__object2.column1 "table1__manyToManyObject2__object2__column1", table1__manyToManyObject2__object2.column2 "table1__manyToManyObject2__object2__column2", table1__manyToManyObject2__object2.column3 "table1__manyToManyObject2__object2__column3", table1__manyToManyObject2__object2.one_to_one_object1_id "table1__manyToManyObject2__object2__one_to_one_object1_id", table1__manyToManyObject2__object2.one_to_many_object2_many_to_one_id "table1__manyToManyObject2__object2__one_to_many_object2_many_to_one_id" FROM table1 table1 LEFT JOIN many_to_many_table2 table1__manyToManyObject2 ON table1.id = table1__manyToManyObject2.table1_id LEFT JOIN table2 table1__manyToManyObject2__object2 ON table1__manyToManyObject2.table2_id = table1__manyToManyObject2__object2.id WHERE table1.id = ? AND table1.column1 = ? AND table1__manyToManyObject2.column1 = ? AND table1__manyToManyObject2__object2.column1 = ?')
    })

    it('should join one-to-many relationships which are criteria-less', function() {
      let criteria = {
        manyToManyObject2: {
          object2: {}
        }
      }
  
      let query = queryTools.buildCriteriaReadQuery(schema.getTable('table1'), criteria, true)
  
      expect(query._select!.pieces!.length).to.equal(20)
      expect(query._select!.pieces![0]).to.equal('table1.id "table1__id"')
      expect(query._select!.pieces![1]).to.equal('table1.column1 "table1__column1"')
      expect(query._select!.pieces![2]).to.equal('table1.column2 "table1__column2"')
      expect(query._select!.pieces![3]).to.equal('table1.column3 "table1__column3"')
      expect(query._select!.pieces![4]).to.equal('table1.many_to_one_object1_id "table1__many_to_one_object1_id"')
      expect(query._select!.pieces![5]).to.equal('table1.many_to_one_object2_id "table1__many_to_one_object2_id"')
      expect(query._select!.pieces![6]).to.equal('table1.one_to_one_object1_id "table1__one_to_one_object1_id"')
      expect(query._select!.pieces![7]).to.equal('table1.one_to_one_object2_id "table1__one_to_one_object2_id"')
      expect(query._select!.pieces![8]).to.equal('table1.one_to_many_object1_many_to_one_id "table1__one_to_many_object1_many_to_one_id"')
      expect(query._select!.pieces![9]).to.equal('table1__manyToManyObject2.table1_id "table1__manyToManyObject2__table1_id"')
      expect(query._select!.pieces![10]).to.equal('table1__manyToManyObject2.table2_id "table1__manyToManyObject2__table2_id"')
      expect(query._select!.pieces![11]).to.equal('table1__manyToManyObject2.column1 "table1__manyToManyObject2__column1"')
      expect(query._select!.pieces![12]).to.equal('table1__manyToManyObject2.column2 "table1__manyToManyObject2__column2"')
      expect(query._select!.pieces![13]).to.equal('table1__manyToManyObject2.column3 "table1__manyToManyObject2__column3"')
      expect(query._select!.pieces![14]).to.equal('table1__manyToManyObject2__object2.id "table1__manyToManyObject2__object2__id"')
      expect(query._select!.pieces![15]).to.equal('table1__manyToManyObject2__object2.column1 "table1__manyToManyObject2__object2__column1"')
      expect(query._select!.pieces![16]).to.equal('table1__manyToManyObject2__object2.column2 "table1__manyToManyObject2__object2__column2"')
      expect(query._select!.pieces![17]).to.equal('table1__manyToManyObject2__object2.column3 "table1__manyToManyObject2__object2__column3"')
      expect(query._select!.pieces![18]).to.equal('table1__manyToManyObject2__object2.one_to_one_object1_id "table1__manyToManyObject2__object2__one_to_one_object1_id"')
      expect(query._select!.pieces![19]).to.equal('table1__manyToManyObject2__object2.one_to_many_object2_many_to_one_id "table1__manyToManyObject2__object2__one_to_many_object2_many_to_one_id"')

      expect(query.mysql()).to.equal('SELECT table1.id "table1__id", table1.column1 "table1__column1", table1.column2 "table1__column2", table1.column3 "table1__column3", table1.many_to_one_object1_id "table1__many_to_one_object1_id", table1.many_to_one_object2_id "table1__many_to_one_object2_id", table1.one_to_one_object1_id "table1__one_to_one_object1_id", table1.one_to_one_object2_id "table1__one_to_one_object2_id", table1.one_to_many_object1_many_to_one_id "table1__one_to_many_object1_many_to_one_id", table1__manyToManyObject2.table1_id "table1__manyToManyObject2__table1_id", table1__manyToManyObject2.table2_id "table1__manyToManyObject2__table2_id", table1__manyToManyObject2.column1 "table1__manyToManyObject2__column1", table1__manyToManyObject2.column2 "table1__manyToManyObject2__column2", table1__manyToManyObject2.column3 "table1__manyToManyObject2__column3", table1__manyToManyObject2__object2.id "table1__manyToManyObject2__object2__id", table1__manyToManyObject2__object2.column1 "table1__manyToManyObject2__object2__column1", table1__manyToManyObject2__object2.column2 "table1__manyToManyObject2__object2__column2", table1__manyToManyObject2__object2.column3 "table1__manyToManyObject2__object2__column3", table1__manyToManyObject2__object2.one_to_one_object1_id "table1__manyToManyObject2__object2__one_to_one_object1_id", table1__manyToManyObject2__object2.one_to_many_object2_many_to_one_id "table1__manyToManyObject2__object2__one_to_many_object2_many_to_one_id" FROM table1 table1 LEFT JOIN many_to_many_table2 table1__manyToManyObject2 ON table1.id = table1__manyToManyObject2.table1_id LEFT JOIN table2 table1__manyToManyObject2__object2 ON table1__manyToManyObject2.table2_id = table1__manyToManyObject2__object2.id')
    })
  })
})
