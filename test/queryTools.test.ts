import { expect } from 'chai'
import { Query } from 'knight-sql'
import 'mocha'
import { addCriteria, buildSelectQuery } from '../src/queryTools'
import { schema } from './testSchema'

describe.only('queryTools', function() {
  describe('addCriteria', function() {
    it('should add a simple equals comparison', function() {
      let criteria = {
        column1: 'a'
      }
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
  
      expect(query._where.mysql()).to.equal('column1 = ?')
      expect(query._where.values()).to.deep.equal(['a'])
    })
  
    it('should add two simple equals comparisons which are AND connected', function() {
      let criteria = {
        column1: 'a',
        column2: 1
      }
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
  
      expect(query._where.mysql()).to.equal('column1 = ? AND column2 = ?')
      expect(query._where.values()).to.deep.equal(['a',1])
    })
  
    it('should add a comparison', function() {
      let criteria = {
        column1: {
          '@operator': '<>',
          '@value': 'a'
        }
      }
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
      
      expect(query._where.mysql()).to.equal('column1 <> ?')
      expect(query._where.values()).to.deep.equal(['a'])
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
      addCriteria(schema, 'table1', query1, criteria1)
      
      expect(query1._where.mysql()).to.equal('column1 <> ? AND column2 = ?')
      expect(query1._where.values()).to.deep.equal(['a',1])

      let criteria2 = {
        column1: 'a',
        column2: {
          '@operator': '<>',
          '@value': 1
        }
      }
  
      let query2 = new Query
      addCriteria(schema, 'table1', query2, criteria2)
      
      expect(query2._where.mysql()).to.equal('column1 = ? AND column2 <> ?')
      expect(query2._where.values()).to.deep.equal(['a',1])
    })
  
    it('should not add a comparison if the operator is not supported', function() {
      let criteria = {
        column1: {
          '@operator': '; DELETE FROM table1;',
          '@value': 'a'
        }
      }
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
      
      expect(query._where.mysql()).to.equal('')
      expect(query._where.values()).to.deep.equal([])
    })
  
    it('should not add a property and value citerium if the value is undefined', function() {
      let criteria = {
        column1: {
          '@operator': '<>',
          '@value': undefined
        }
      }
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
      
      expect(query._where.mysql()).to.equal('')
    })
  
    it('should add a null criterium', function() {
      let criteria1 = {
        column1: null
      }
  
      let query1 = new Query
      addCriteria(schema, 'table1', query1, criteria1)
  
      expect(query1._where.mysql()).to.equal('column1 IS NULL')
      expect(query1._where.values()).to.deep.equal([])
  
      let criteria2 = {
        column1: {
          '@operator': '=',
          '@value': null
        }
      }
  
      let query2 = new Query
      addCriteria(schema, 'table1', query2, criteria2)
      
      expect(query2._where.mysql()).to.equal('column1 IS NULL')
      expect(query2._where.values()).to.deep.equal([])

      let criteria3 = {
        column1: {
          '@operator': '!=',
          '@value': null
        }
      }
  
      let query3 = new Query
      addCriteria(schema, 'table1', query3, criteria3)
      
      expect(query3._where.mysql()).to.equal('column1 IS NOT NULL')
      expect(query3._where.values()).to.deep.equal([])

      let criteria4 = {
        column1: {
          '@operator': '<>',
          '@value': null
        }
      }
  
      let query4 = new Query
      addCriteria(schema, 'table1', query4, criteria4)
      
      expect(query4._where.mysql()).to.equal('column1 IS NOT NULL')
      expect(query4._where.values()).to.deep.equal([])
    })
  
    it('should create an IN operator of an array of values', function() {
      let criteria1 = {
        column1: [1, 2, 3, 4]
      }
  
      let query1 = new Query
      addCriteria(schema, 'table1', query1, criteria1)
      
      expect(query1._where.mysql()).to.equal('column1 IN (?, ?, ?, ?)')
      expect(query1._where.values()).to.deep.equal([1,2,3,4])
  
      let criteria2 = {
        column1: ['a', 'b', 'c', 'd']
      }
  
      let query2 = new Query
      addCriteria(schema, 'table1', query2, criteria2)
      
      expect(query2._where.mysql()).to.equal('column1 IN (?, ?, ?, ?)')
      expect(query2._where.values()).to.deep.equal(['a', 'b', 'c', 'd'])
  
      let date1 = new Date
      let date2 = new Date
  
      let criteria3 = {
        column1: [date1, date2]
      }
  
      let query3 = new Query
      addCriteria(schema, 'table1', query3, criteria3)
      
      expect(query3._where.mysql()).to.equal('column1 IN (?, ?)')
      expect(query3._where.values()).to.deep.equal([date1, date2])
    })
  
    it('should accept an array of comparisons', function() {
      let criteria = {
        column2: [
          {
            '@operator': '<',
            '@value': 1
          },
          {
            '@operator': '>',
            '@value': 10
          }
        ]
      }
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
      
      expect(query._where.mysql()).to.equal('(column2 < ? OR column2 > ?)')
      expect(query._where.values()).to.deep.equal([1, 10])
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
      addCriteria(schema, 'table1', query, criteria)
      
      expect(query._where.mysql()).to.equal('(column2 < ?)')
      expect(query._where.values()).to.deep.equal([1])
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
      addCriteria(schema, 'table1', query, criteria)
      
      expect(query._where.mysql()).to.equal('')
      expect(query._where.values()).to.deep.equal([])
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
      addCriteria(schema, 'table1', query, criteria)
      
      expect(query._where.mysql()).to.equal('(column2 < ?)')
      expect(query._where.values()).to.deep.equal([1])
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
      addCriteria(schema, 'table1', query, criteria)
      
      expect(query._where.mysql()).to.equal('')
      expect(query._where.values()).to.deep.equal([])
    })

    it('should set an empty array as always being false', function() {
      let criteria = {
        column1: []
      }
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
  
      expect(query._where.mysql()).to.equal('1 = 2')
      expect(query._where.values()).to.deep.equal([])
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
        ]
      }
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
      
      expect(query._where.mysql()).to.equal('(1 = 2 OR 1 = 2 OR 1 = 1 OR 1 = 1 OR 1 = 1)')
      expect(query._where.values()).to.deep.equal([])
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
            '@operator': '<',
            '@value': 10
          },
          'AND'
        ]
      }
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
      
      expect(query._where.mysql()).to.equal('(column2 > ? AND column2 < ?)')
      expect(query._where.values()).to.deep.equal([1, 10])
    })

    it('should regard inherited properties', function() {
      let criteria = new TestSubCriteria
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
  
      expect(query._where.mysql()).to.equal('column1 = ? AND column2 = ?')
      expect(query._where.values()).to.deep.equal(['a', 1])
    })
  
    it('should regard property methods', function() {
      let criteria = new TestPropertyMethods
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
  
      expect(query._where.mysql()).to.equal('column1 = ? AND column2 = ?')
      expect(query._where.values()).to.deep.equal(['a', 1])
    })
  
    it('should add Date comparisons', function() {
      let now = new Date
      let criteria = { column1: now }
  
      let query = new Query
      addCriteria(schema, 'table1', query, criteria)
  
      expect(query._where.mysql()).to.equal('column1 = ?')
      expect(query._where.values()).to.deep.equal([now])
    })

    it('should join criteria for a relationship', function() {
      let criteria = {
        manyObjects: {
          column1: 'a'
        }
      }

      let query = new Query
      addCriteria(schema, 'table1', query, criteria)

      expect(query._join.length).to.equal(1)
      expect(query._join[0].type).to.equal('LEFT')
      expect(query._join[0].table).to.equal('table_many')
      expect(query._join[0].alias).to.equal('manyObjects')
      expect(query._join[0].on).to.equal('id = manyObjects.table1_id')
      expect(query._where.mysql()).to.equal('manyObjects.column1 = ?')
      expect(query._where.values()).to.deep.equal(['a'])
    })

    it('should join criteria for a relationship if it is to load', function() {
      let criteria = {
        manyObjects: {
          '@load': true,
          column1: 'a'
        }
      }

      let query = new Query
      addCriteria(schema, 'table1', query, criteria)

      expect(query._join.length).to.equal(1)
      expect(query._join[0].type).to.equal('LEFT')
      expect(query._join[0].table).to.equal('table_many')
      expect(query._join[0].alias).to.equal('manyObjects')
      expect(query._join[0].on).to.equal('id = manyObjects.table1_id')
      expect(query._where.mysql()).to.equal('manyObjects.column1 = ?')
      expect(query._where.values()).to.deep.equal(['a'])
    })

    it('should not join criteria for a relationship if it is to load with new query', function() {
      let criteria = {
        manyObjects: {
          '@loadSeparately': true,
          column1: 'a'
        }
      }

      let query = new Query
      addCriteria(schema, 'table1', query, criteria)

      expect(query._join.length).to.equal(0)
      expect(query._where.pieces.length).to.equal(0)
    })

    it('should join criteria for a relationship of a relationship', function() {
      let criteria = {
        manyObjects: {
          column1: 'a',
          object1: {
            column1: 'b'
          }
        }
      }

      let query = new Query
      addCriteria(schema, 'table1', query, criteria)

      expect(query._join.length).to.equal(2)
      expect(query._join[0].type).to.equal('LEFT')
      expect(query._join[0].table).to.equal('table_many')
      expect(query._join[0].alias).to.equal('manyObjects')
      expect(query._join[0].on).to.equal('id = manyObjects.table1_id')
      expect(query._join[1].type).to.equal('LEFT')
      expect(query._join[1].table).to.equal('table1')
      expect(query._join[1].alias).to.equal('manyObjects__object1')
      expect(query._join[1].on).to.equal('manyObjects.table1_id = manyObjects__object1.id')
      expect(query._where.mysql()).to.equal('manyObjects.column1 = ? AND manyObjects__object1.column1 = ?')
      expect(query._where.values()).to.deep.equal(['a','b'])
    })

    it('should not join criteria for a relationship of a relationship', function() {
      let criteria = {
        manyObjects: {
          column1: 'a',
          object1: {
            '@loadSeparately': true,
            column1: 'b'
          }
        }
      }

      let query = new Query
      addCriteria(schema, 'table1', query, criteria)

      expect(query._join.length).to.equal(1)
      expect(query._join[0].type).to.equal('LEFT')
      expect(query._join[0].table).to.equal('table_many')
      expect(query._join[0].alias).to.equal('manyObjects')
      expect(query._join[0].on).to.equal('id = manyObjects.table1_id')
      expect(query._where.mysql()).to.equal('manyObjects.column1 = ?')
      expect(query._where.values()).to.deep.equal(['a'])
    })

    it('should accept an array and connect two criteria objects with OR', function() {
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
      addCriteria(schema, 'table1', query, criteria)

      expect(query._where.mysql()).to.equal('(column1 = ? AND column2 = ?) XOR (column1 = ? AND column2 = ?)')
      expect(query._where.values()).to.deep.equal(['a',1,'b',2])
    })

    it('should accept an array and connect two criteria objects with OR', function() {
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
      addCriteria(schema, 'table1', query, criteria)

      expect(query._where.mysql()).to.equal('(column1 = ? AND column2 = ?) XOR ((column1 = ? AND column2 = ?) OR (column1 = ? AND column2 = ?))')
      expect(query._where.values()).to.deep.equal(['a',1,'b',2,'c',3])
    })
  })  

  describe('buildSelectQuery', function() {
    it('should handle a simple select query', function() {
      let criteria = { column1: 'a', column2: 1 }
      let query = buildSelectQuery(schema, 'table1', criteria)
      expect(query.mysql()).to.equal('SELECT table1.id "table1__id", table1.column1 "table1__column1", table1.column2 "table1__column2", table1.table1_id "table1__table1_id", table1.table2_id "table1__table2_id" FROM table1 table1 WHERE table1.column1 = ? AND table1.column2 = ?')
    })
  
    it('should handle inter table relationships', function() {
      let criteria = {
        id: 1,
        column1: 'a',
        manyObjects: {
          '@load': true,
          column1: 'b',
          object2: {
            '@load': true,
            column1: 'c'
          }
        }
      }
  
      let query = buildSelectQuery(schema, 'table1', criteria)
  
      expect(query._select.length).to.equal(12)
      expect(query._select[0]).to.equal('table1.id "table1__id"')
      expect(query._select[1]).to.equal('table1.column1 "table1__column1"')
      expect(query._select[2]).to.equal('table1.column2 "table1__column2"')
      expect(query._select[3]).to.equal('table1.table1_id "table1__table1_id"')
      expect(query._select[4]).to.equal('table1.table2_id "table1__table2_id"')
      expect(query._select[5]).to.equal('table1__manyObjects.table1_id "table1__manyObjects__table1_id"')
      expect(query._select[6]).to.equal('table1__manyObjects.table2_id "table1__manyObjects__table2_id"')
      expect(query._select[7]).to.equal('table1__manyObjects.column1 "table1__manyObjects__column1"')
      expect(query._select[8]).to.equal('table1__manyObjects.table1_id2 "table1__manyObjects__table1_id2"')
      expect(query._select[9]).to.equal('table1__manyObjects__object2.id "table1__manyObjects__object2__id"')
      expect(query._select[10]).to.equal('table1__manyObjects__object2.column1 "table1__manyObjects__object2__column1"')
      expect(query._select[11]).to.equal('table1__manyObjects__object2.table1_id "table1__manyObjects__object2__table1_id"')
  
      expect(query.mysql()).to.equal('SELECT table1.id "table1__id", table1.column1 "table1__column1", table1.column2 "table1__column2", table1.table1_id "table1__table1_id", table1.table2_id "table1__table2_id", table1__manyObjects.table1_id "table1__manyObjects__table1_id", table1__manyObjects.table2_id "table1__manyObjects__table2_id", table1__manyObjects.column1 "table1__manyObjects__column1", table1__manyObjects.table1_id2 "table1__manyObjects__table1_id2", table1__manyObjects__object2.id "table1__manyObjects__object2__id", table1__manyObjects__object2.column1 "table1__manyObjects__object2__column1", table1__manyObjects__object2.table1_id "table1__manyObjects__object2__table1_id" FROM table1 table1 LEFT JOIN table_many table1__manyObjects ON table1.id = table1__manyObjects.table1_id LEFT JOIN table2 table1__manyObjects__object2 ON table1__manyObjects.table2_id = table1__manyObjects__object2.id WHERE table1.id = ? AND table1.column1 = ? AND table1__manyObjects.column1 = ? AND table1__manyObjects__object2.column1 = ?')
    })

    it('should join one-to-many relationships which are criteria-less', function() {
      let criteria = {
        manyObjects: {
          object2: {}
        }
      }
  
      let query = buildSelectQuery(schema, 'table1', criteria)
  
      expect(query._select.length).to.equal(12)
      expect(query._select[0]).to.equal('table1.id "table1__id"')
      expect(query._select[1]).to.equal('table1.column1 "table1__column1"')
      expect(query._select[2]).to.equal('table1.column2 "table1__column2"')
      expect(query._select[3]).to.equal('table1.table1_id "table1__table1_id"')
      expect(query._select[4]).to.equal('table1.table2_id "table1__table2_id"')
      expect(query._select[5]).to.equal('table1__manyObjects.table1_id "table1__manyObjects__table1_id"')
      expect(query._select[6]).to.equal('table1__manyObjects.table2_id "table1__manyObjects__table2_id"')
      expect(query._select[7]).to.equal('table1__manyObjects.column1 "table1__manyObjects__column1"')
      expect(query._select[8]).to.equal('table1__manyObjects.table1_id2 "table1__manyObjects__table1_id2"')
      expect(query._select[9]).to.equal('table1__manyObjects__object2.id "table1__manyObjects__object2__id"')
      expect(query._select[10]).to.equal('table1__manyObjects__object2.column1 "table1__manyObjects__object2__column1"')
      expect(query._select[11]).to.equal('table1__manyObjects__object2.table1_id "table1__manyObjects__object2__table1_id"')

      expect(query.mysql()).to.equal('SELECT table1.id "table1__id", table1.column1 "table1__column1", table1.column2 "table1__column2", table1.table1_id "table1__table1_id", table1.table2_id "table1__table2_id", table1__manyObjects.table1_id "table1__manyObjects__table1_id", table1__manyObjects.table2_id "table1__manyObjects__table2_id", table1__manyObjects.column1 "table1__manyObjects__column1", table1__manyObjects.table1_id2 "table1__manyObjects__table1_id2", table1__manyObjects__object2.id "table1__manyObjects__object2__id", table1__manyObjects__object2.column1 "table1__manyObjects__object2__column1", table1__manyObjects__object2.table1_id "table1__manyObjects__object2__table1_id" FROM table1 table1 LEFT JOIN table_many table1__manyObjects ON table1.id = table1__manyObjects.table1_id LEFT JOIN table2 table1__manyObjects__object2 ON table1__manyObjects.table2_id = table1__manyObjects__object2.id')
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
