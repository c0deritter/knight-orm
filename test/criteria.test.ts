import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import { CriteriaObject } from 'knight-criteria'
import { Join, Query } from 'knight-sql'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { store } from '../src'
import { addCriteria, buildCriteriaReadQuery, criteriaDelete, criteriaRead, determineRelationshipsToLoadSeparately, instanceCriteriaToRowCriteria, validateCriteria } from '../src/criteria'
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

describe('criteria', function() {
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

  describe('validateCriteria', function() {
    it('should not find issues if the given criteria empty', function() {
      expect(validateCriteria(schema.getTable('table1'), {}, true)).to.deep.equal([])
    })

    it('should not find issues if the given criteria are valid', function() {
      expect(validateCriteria(schema.getTable('table1'), {
        id: 1,
        column1: 'a',
        manyToOneObject2: {
          column2: 1,
          '@orderBy': 'id',
          '@limit': 5,
          '@offset': 10
        },
        '@orderBy': 'id',
        '@limit': 5,
        '@offset': 10
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given comparison is valid', function() {
      expect(validateCriteria(schema.getTable('table1'), {
        column1: {
          '@operator': '=',
          '@value': 'a'
        },
        column2: {
          '@operator': '>'
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given criteria which are given as an array are valid', function() {
      expect(validateCriteria(schema.getTable('table1'), [{
        id: 1,
        column1: 'a',
        manyToOneObject2: {
          column2: 1,
          '@orderBy': 'id',
          '@limit': 5,
          '@offset': 10  
        },
        '@orderBy': 'id',
        '@limit': 5,
        '@offset': 10
      }], true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @load', function() {
      expect(validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@load': true
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @loadSeparately', function() {
      expect(validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@loadSeparately': true
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @not', function() {
      expect(validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@not': true
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @count', function() {
      expect(validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@count': true
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @max', function() {
      expect(validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@max': true
        }
      }, true)).to.deep.equal([])
    })

    it('should not find issues if the given relationship has an @min', function() {
      expect(validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          '@min': true
        }
      }, true)).to.deep.equal([])
    })

    it('should find an issue if a column, relationship or @property does not exist', function() {
      expect(validateCriteria(schema.getTable('table1'), {
        column: 'a',
        object: {},
        '@invalid': true
      }, true)).to.deep.equal([
        {
          location: 'column',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'object',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: '@invalid',
          message: 'Given column, relationship or @-property does not exist'
        }
      ])
    })

    it('should find an issue if a column, relationship or @property does not exist in a relationship', function() {
      expect(validateCriteria(schema.getTable('table1'), {
        manyToOneObject2: {
          column: 'a',
          object: {},
          '@invalid': true
        }
      }, true)).to.deep.equal([
        {
          location: 'manyToOneObject2.column',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'manyToOneObject2.object',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'manyToOneObject2.@invalid',
          message: 'Given column, relationship or @-property does not exist'
        }
      ])
    })

    it('should find an issue if a column, relationship or @property does not exist in a relationship with criteria given as an array', function() {
      expect(validateCriteria(schema.getTable('table1'), [{
        manyToOneObject2: {
          column: 'a',
          object: {},
          '@invalid': true
        }
      }], true)).to.deep.equal([
        {
          location: 'manyToOneObject2.column',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'manyToOneObject2.object',
          message: 'Given column, relationship or @-property does not exist'
        },
        {
          location: 'manyToOneObject2.@invalid',
          message: 'Given column, relationship or @-property does not exist'
        }
      ])
    })
  })

  describe('instanceCriteriaToRowCriteria', function() {
    it('should convert simple instance criteria', function() {
      let instanceCriteria = {
        property1: 'a',
        property2: { operator: '>', value: 1 }
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        column1: 'a',
        column2: { operator: '>', value: 1 }
      })
    })

    it('should convert instance criteria with a relationship', function() {
      let instanceCriteria = {
        property1: 'a',
        property2: { operator: '>', value: 1 },
        manyToManyObject2: {
          property1: { operator: 'LIKE', value: '%b%' },
          object2: {
            property1: 'c'
          }
        }
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        column1: 'a',
        column2: { operator: '>', value: 1 },
        manyToManyObject2: {
          column1: { operator: 'LIKE', value: '%b%' },
          object2: {
            column1: 'c'
          }
        }
      })
    })

    it('should convert instance criteria given as array', function() {
      let instanceCriteria = [
        {
          property1: 'a',
          property2: { operator: '>', value: 1 }
        },
        'OR',
        {
          manyToManyObject2: {
            property1: { operator: 'LIKE', value: '%b%' },
            object2: {
              property1: 'c'
            }
          }  
        }
      ]

      let rowCriteria = instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal([
        {
          column1: 'a',
          column2: { operator: '>', value: 1 }
        },
        'OR',
        {
          manyToManyObject2: {
            column1: { operator: 'LIKE', value: '%b%' },
            object2: {
              column1: 'c'
            }
          }
        }
      ])
    })

    it('should preserve criteria specific properties that start with @', function() {
      let instanceCriteria: CriteriaObject = {
        '@not': true,
        '@load': true,
        '@loadSeparately': true,
        '@count': 1,
        '@min': 2,
        '@max': { '@operator': '<', '@value': 10 },
        '@limit': 10,
        '@offset': 20
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        '@not': true,
        '@load': true,
        '@loadSeparately': true,
        '@count': 1,
        '@min': 2,
        '@max': { '@operator': '<', '@value': 10 },
        '@limit': 10,
        '@offset': 20
      })
    })

    it('should not preserve properties that start with @ but are invalid', function() {
      let instanceCriteria = {
        '@invalid': true
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal({})
    })

    it('should convert an order by which refers single property', function() {
      let instanceCriteria = {
        '@orderBy': 'property1'
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        '@orderBy': 'column1'
      })
    })

    it('should convert an order by which uses an order by object', function() {
      let instanceCriteria = {
        '@orderBy': {
          field: 'property1',
          direction: 'DESC'
        }
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        '@orderBy': {
          field: 'column1',
          direction: 'DESC'
        }
      })
    })

    it('should convert an order by which uses an array of single properties and order by objects', function() {
      let instanceCriteria = {
        '@orderBy': [
          {
            field: 'property1',
            direction: 'DESC'
          },
          'property2'
        ]
      }

      let rowCriteria = instanceCriteriaToRowCriteria(schema.getTable('table1'), instanceCriteria)

      expect(rowCriteria).to.deep.equal({
        '@orderBy': [
          {
            field: 'column1',
            direction: 'DESC'
          },
          'column2'
        ]
      })
    })
  })

  describe('addCriteria', function() {
    it('should add a simple equals comparison', function() {
      let criteria = {
        column1: 'a'
      }
  
      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)
  
      expect(query._where!.mysql()).to.equal('table1.column1 = ?')
      expect(query._where!.values()).to.deep.equal(['a'])
    })
  
    it('should add two simple equals comparisons which are AND connected', function() {
      let criteria = {
        column1: 'a',
        column2: 1
      }
  
      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)
  
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
  
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
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
      addCriteria(schema.getTable('table1'), query1, criteria1, true)
      
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
      addCriteria(schema.getTable('table1'), query2, criteria2, true)
      
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('')
    })

    it('should add a null criterium', function() {
      let criteria1 = {
        column1: null
      }
  
      let query1 = new Query
      addCriteria(schema.getTable('table1'), query1, criteria1, true)
  
      expect(query1._where!.mysql()).to.equal('table1.column1 IS NULL')
      expect(query1._where!.values()).to.deep.equal([])
  
      let criteria2 = {
        column1: {
          '@operator': '=',
          '@value': null
        }
      }
  
      let query2 = new Query
      addCriteria(schema.getTable('table1'), query2, criteria2, true)
      
      expect(query2._where!.mysql()).to.equal('table1.column1 IS NULL')
      expect(query2._where!.values()).to.deep.equal([])

      let criteria3 = {
        column1: {
          '@operator': '!=',
          '@value': null
        }
      }
  
      let query3 = new Query
      addCriteria(schema.getTable('table1'), query3, criteria3, true)
      
      expect(query3._where!.mysql()).to.equal('table1.column1 IS NOT NULL')
      expect(query3._where!.values()).to.deep.equal([])

      let criteria4 = {
        column1: {
          '@operator': '<>',
          '@value': null
        }
      }
  
      let query4 = new Query
      addCriteria(schema.getTable('table1'), query4, criteria4, true)
      
      expect(query4._where!.mysql()).to.equal('table1.column1 IS NOT NULL')
      expect(query4._where!.values()).to.deep.equal([])
    })
  
    it('should create an IN operator of an array of values', function() {
      let criteria1 = {
        column1: [1, 2, 3, 4]
      }
  
      let query1 = new Query
      addCriteria(schema.getTable('table1'), query1, criteria1, true)
      
      expect(query1._where!.mysql()).to.equal('table1.column1 IN (?, ?, ?, ?)')
      expect(query1._where!.values()).to.deep.equal([1,2,3,4])

      let criteria2 = {
        column1: ['a', 'b', 'c', 'd']
      }
  
      let query2 = new Query
      addCriteria(schema.getTable('table1'), query2, criteria2, true)
      
      expect(query2._where!.mysql()).to.equal('table1.column1 IN (?, ?, ?, ?)')
      expect(query2._where!.values()).to.deep.equal(['a', 'b', 'c', 'd'])
  
      let date1 = new Date
      let date2 = new Date
  
      let criteria3 = {
        column1: [date1, date2]
      }
  
      let query3 = new Query
      addCriteria(schema.getTable('table1'), query3, criteria3, true)
      
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('')
      expect(query._where!.values()).to.deep.equal([])
    })

    it('should set an empty array as always being false', function() {
      let criteria = {
        column1: []
      }
  
      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)
  
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
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
      addCriteria(schema.getTable('table1'), query, criteria, true)
      
      expect(query._where!.mysql()).to.equal('(table1.column2 > ? AND NOT table1.column2 < ?)')
      expect(query._where!.values()).to.deep.equal([1, 10])
    })

    it('should regard inherited properties', function() {
      let criteria = new TestSubCriteria
  
      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)
  
      expect(query._where!.mysql()).to.equal('table1.column1 = ? AND table1.column2 = ?')
      expect(query._where!.values()).to.deep.equal(['a', 1])
    })
  
    it('should regard property methods', function() {
      let criteria = new TestPropertyMethods
  
      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)
  
      expect(query._where!.mysql()).to.equal('table1.column1 = ? AND table1.column2 = ?')
      expect(query._where!.values()).to.deep.equal(['a', 1])
    })
  
    it('should add Date comparisons', function() {
      let now = new Date
      let criteria = { column1: now }
  
      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)
  
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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1')
    })

    it('should not add an order by condition if the column is invalid', function() {
      let criteria = {
        '@orderBy': 'column4'
      }

      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1, table1__manyToManyObject2.column1')
    })

    it('should add multiple order by conditions', function() {
      let criteria = {
        '@orderBy': ['column1', 'column2']
      }

      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.not.undefined
      expect(query._orderBy!.sql('mysql')).to.equal('table1.column1, table1.column2, table1__manyToManyObject2.column1')
    })

    it('should not add multiple order by conditions if they are invalid', function() {
      let criteria = {
        '@orderBy': ['column4', 'column5']
      }

      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._orderBy).to.be.undefined
    })

    it('should set a limit', function() {
      let criteria = {
        '@limit': 10
      }

      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._limit).to.equal(10)
    })

    it('should not overwrite an already existing limit', function() {
      let criteria = {
        '@limit': 10
      }

      let query = new Query
      query.limit(5)
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._limit).to.equal(10)
    })

    it('should set an offset', function() {
      let criteria = {
        '@offset': 10
      }

      let query = new Query
      addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._offset).to.equal(10)
    })

    it('should not overwrite an already existing offset', function() {
      let criteria = {
        '@offset': 10
      }

      let query = new Query
      query.offset(5)
      addCriteria(schema.getTable('table1'), query, criteria, true)

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
      addCriteria(schema.getTable('table1'), query, criteria, true)

      expect(query._offset).to.equal(10)
    })
  })

  describe('determineRelationshipsToLoadSeparately', function() {
    it('should not load a relationship which does not have any criteria', function() {
      let criteria = {}
      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(0)
    })

    it('should load a relationship which should be loaded separately', function() {
      let criteria = { manyToManyObject2: { '@loadSeparately': true }}
      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToManyObject2']).to.deep.equal({
        relationship: schema.getTable('table1').getRelationship('manyToManyObject2'),
        relationshipCriteria: { '@loadSeparately': true },
        objs: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })

    it('should not load a relationship which should be not loaded separately', function() {
      let criteria = { manyToManyObject2: { '@loadSeparately': false }}
      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(0)
    })

    it('should determine the relationships to load of an already JOIN loaded relationship', function() {
      let criteria = { manyToManyObject2: { '@load': true, object1: { '@load': true }, object2: { '@loadSeparately': true }}}
      let rows = [
        { column1: 'a', column2: 1, manyToManyObject2: [ { column1: 'a1' }, { column1: 'a2' } ] },
        { column1: 'b', column2: 2, manyToManyObject2: [ { column1: 'b1' } ] },
        { column1: 'c', column2: 3, manyToManyObject2: [] },
      ]

      let toLoad = determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToManyObject2.object2']).to.deep.equal({
        relationship: schema.getTable('many_to_many_table2').getRelationship('object2'),
        relationshipCriteria: { '@loadSeparately': true },
        objs: [
          { column1: 'a1' },
          { column1: 'a2' },
          { column1: 'b1' },
        ]
      })
    })

    it('should not determine the relationships to load of relationship that is not to load', function() {
      let criteria = { manyToManyObject2: { object1: { '@load': true }, object2: { '@loadSeparately': true }}}
      let rows = [
        { column1: 'a', column2: 1, manyToManyObject2: [ { column1: 'a1' }, { column1: 'a2' } ] },
        { column1: 'b', column2: 2, manyToManyObject2: [ { column1: 'b1' } ] },
        { column1: 'c', column2: 3, manyToManyObject2: [] },
      ]

      let toLoad = determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(0)
    })

    it('should determine the relationships to load if inside an array', function() {
      let criteria = [
        { manyToManyObject2: { '@loadSeparately': true }},
        'XOR',
        {}
      ]

      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToManyObject2']).to.deep.equal({
        relationship: schema.getTable('table1').getRelationship('manyToManyObject2'),
        relationshipCriteria: { '@loadSeparately': true },
        objs: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })

    it('should determine the relationships to load if inside an array of an array', function() {
      let criteria = [
        [ { manyToManyObject2: { '@loadSeparately': true }} ],
        'XOR',
        {}
      ]

      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToManyObject2']).to.deep.equal({
        relationship: schema.getTable('table1').getRelationship('manyToManyObject2'),
        relationshipCriteria: { '@loadSeparately': true },
        objs: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })

    it('should use the criteria of first occuring relationship if there is not just one criteria for that relationship', function() {
      let criteria = [
        { manyToManyObject2: { '@loadSeparately': true, column1: 'a' }},
        'XOR',
        { manyToManyObject2: { '@loadSeparately': true, column1: 'b' }}
      ]

      let rows = [
        { column1: 'a', column2: 1 },
        { column1: 'b', column2: 2 },
        { column1: 'c', column2: 3 },
      ]

      let toLoad = determineRelationshipsToLoadSeparately(schema.getTable('table1'), rows, criteria)

      expect(Object.keys(toLoad).length).to.equal(1)
      expect(toLoad['.manyToManyObject2']).to.deep.equal({
        relationship: schema.getTable('table1').getRelationship('manyToManyObject2'),
        relationshipCriteria: { '@loadSeparately': true, column1: 'a' },
        objs: [
          { column1: 'a', column2: 1 },
          { column1: 'b', column2: 2 },
          { column1: 'c', column2: 3 },
        ]
      })
    })
  })

  describe('buildCriteriaReadQuery', function() {
    it('should handle a simple select query', function() {
      let criteria = { column1: 'a', column2: 1 }
      let query = buildCriteriaReadQuery(schema.getTable('table1'), criteria, true)
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
  
      let query = buildCriteriaReadQuery(schema.getTable('table1'), criteria, true)
  
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
  
      let query = buildCriteriaReadQuery(schema.getTable('table1'), criteria, true)
  
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

  describe('select', function() {
    it('should select all rows', async function() {
      let date1 = new Date
      let date2 = new Date
      let date3 = new Date
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', column2: 1, column3: date1 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'b', column2: 2, column3: date2 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'c', column2: 3, column3: date3 }, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {}, true)

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
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', column2: 1, column3: date1 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'b', column2: 2, column3: date2 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'c', column2: 3, column3: date3 }, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {
        '@orderBy': {
          field: 'column2',
          direction: 'DESC'
        }
      }, true)

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
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', column2: 1, column3: date1 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'b', column2: 2, column3: date2 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'c', column2: 3, column3: date3 }, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {
        '@limit': 2
      }, true)

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
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', column2: 1, column3: date1 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'b', column2: 2, column3: date2 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'c', column2: 3, column3: date3 }, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {
        '@offset': 2
      }, true)

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
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 1 }}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 2 }}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 3 }}, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {
        column1: 'a',
        manyToOneObject1: {
          column2: 1
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
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

    it('should regard criteria in a many-to-one relationship regarding the id', async function() {
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { manyToOneObject1: { } }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { manyToOneObject1: { } }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { manyToOneObject1: { } }, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {
        manyToOneObject1: {
          id: 1
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        column1: null,
        column2: null,
        column3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should regard criteria in a many-to-one relationship and load it', async function() {
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 1 }}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 2 }}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 3 }}, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {
        column1: 'a',
        manyToOneObject1: {
          '@load': true,
          column2: 1
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 1,
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
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 1 }}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 2 }}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 3 }}, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {
        column1: 'a',
        manyToOneObject1: {
          '@loadSeparately': true,
          column2: 1
        }
      }, true)

      expect(rows.length).to.equal(3)

      expect(rows[0]).to.deep.equal({
        id: 2,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 1,
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
        id: 4,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: 3,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: null
      })

      expect(rows[2]).to.deep.equal({
        id: 6,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: 5,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: null
      })
    })

    it('should regard criteria in a one-to-many relationship', async function() {
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'd' }, { column1: 'e' } ]}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'f' }, { column1: 'g' } ]}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'h' }, { column1: 'i' } ]}, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {
        column1: 'a',
        oneToManyObject1: {
          column1: 'd'
        }
      }, true)

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
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'd' }, { column1: 'e' } ]}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'f' }, { column1: 'g' } ]}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'h' }, { column1: 'i' } ]}, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {
        column1: 'a',
        oneToManyObject1: {
          '@load': true,
          column1: 'd'
        }
      }, true)

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
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'd' }, { column1: 'e' } ]}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'f' }, { column1: 'g' } ]}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', oneToManyObject1: [ { column1: 'h' }, { column1: 'i' } ]}, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, {
        column1: 'a',
        oneToManyObject1: {
          '@loadSeparately': true,
          column1: 'd'
        }
      }, true)

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
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 1 }, oneToManyObject1: [ { column1: 'd' }, { column1: 'e' } ]}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 2 }, oneToManyObject1: [ { column1: 'f' }, { column1: 'g' } ]}, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', manyToOneObject1: { column2: 3 }, oneToManyObject1: [ { column1: 'h' }, { column1: 'i' } ]}, { asDatabaseRow: true })

      let rows = await criteriaRead(schema.getTable('table1'), 'postgres', pgQueryFn, [
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
      ], true)

      expect(rows.length).to.equal(3)
      expect(rows[0]).to.deep.equal({
        id: 2,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 1,
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
            one_to_many_object1_many_to_one_id: 2
          }
        ]
      })

      expect(rows[1]).to.deep.equal({
        id: 6,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: 5,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 5,
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
        id: 10,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: 9,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 9,
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

      let rows = await criteriaRead(schema.getTable('table2'), 'postgres', pgQueryFn, {}, true)

      expect(rows.length).to.equal(0)
    })
  })

  describe('criteriaDelete', function() {
    it('should delete a simple row by id', async function() {
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', column2: 1 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'b', column2: 2 }, { asDatabaseRow: true })

      let deletedRows = await criteriaDelete(schema.getTable('table1'), 'postgres', pgQueryFn, { id: 1 }, true)

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

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result).to.deep.equal([{
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
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', column2: 1 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'b', column2: 2 }, { asDatabaseRow: true })

      let deletedRows = await criteriaDelete(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a' }, true)

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

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result).to.deep.equal([{
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
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'a', column2: 1 }, { asDatabaseRow: true })
      await store(schema.getTable('table1'), 'postgres', pgQueryFn, { column1: 'b', column2: 2 }, { asDatabaseRow: true })

      expect(criteriaDelete(schema.getTable('table1'), 'postgres', pgQueryFn, { invalid: 'invalid' }, true)).to.be.rejectedWith(Error)

      let table1Result = await pgQueryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(2)
      expect(table1Result).to.deep.equal([
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
