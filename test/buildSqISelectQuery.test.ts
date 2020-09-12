import { expect } from 'chai'
import 'mocha'
import { SqlOrm } from '../src/SqlOrm'
import { Schema } from '../src/Schema'

describe('SqlOrm', function() {
  describe('buildSelectQuery', function() {
    it('should handle a simple select query', function() {
      let orm = new SqlOrm(schema)
      let criteria = { a: 'a', b: 1 }
      let query = orm.buildSelectQuery('TableAB', criteria)
      expect(query.mysql()).to.equal('SELECT a, b FROM TableAB WHERE a = ? AND b = ?;')
    })
  
    it('should handle inter table relationships', function() {
      let orm = new SqlOrm(schema)
  
      let criteria = {
        id: 1,
        column1: 'a',
        many: {
          column1: 'b',
          table2: {
            column1: 'c'
          }
        }
      }
  
      let query = orm.buildSelectQuery('Table1', criteria)
  
      expect(query._selects.length).to.equal(7)
      expect(query._selects[0]).to.equal('id')
      expect(query._selects[1]).to.equal('column1')
      expect(query._selects[2]).to.equal('many.table1Id many__table1Id')
      expect(query._selects[3]).to.equal('many.table2Id many__table2Id')
      expect(query._selects[4]).to.equal('many.column1 many__column1')
      expect(query._selects[5]).to.equal('many__table2.id many__table2__id')
      expect(query._selects[6]).to.equal('many__table2.column1 many__table2__column1')
  
      expect(query.mysql()).to.equal('SELECT id, column1, many.table1Id many__table1Id, many.table2Id many__table2Id, many.column1 many__column1, many__table2.id many__table2__id, many__table2.column1 many__table2__column1 FROM Table1 INNER JOIN TableMany many ON id = many.table1Id INNER JOIN Table2 many__table2 ON many.table2Id = many__table2.id WHERE id = ? AND column1 = ? AND many.column1 = ? AND many__table2.column1 = ?;')
    })
  })
  
  describe('rowsToInstances', function() {
    it('should create objects from a simple select query', function() {
      let orm = new SqlOrm(schema)

      let rows = [
        {
          id: 1,
          column1: 'a',
          somethingElse: '?'
        },
        {
          id: 2,
          column1: 'b',
          somethingElse: '?'
        }
      ]

      let criteria = { a: 'a', b: 1 }
      let instances = orm.rowsToInstances(rows, criteria, 'Table1')

      expect(instances.length).to.equal(2)
      expect(instances[0]).to.be.instanceOf(Table1)
      expect(instances[0]).to.deep.equal({ id: 1, column1: 'a' })
      expect(instances[1]).to.be.instanceOf(Table1)
      expect(instances[1]).to.deep.equal({ id: 2, column1: 'b' })
    })

    it.only('should create objects from a simple select query', function() {
      let orm = new SqlOrm(schema)

      let rows = [
        {
          id: 1,
          column1: 'a',
          many__table1Id: 1,
          many__table2Id: 1,
          many__column1: 'b',
          many__table2__id: 1,
          many__table2__column1: 'c'
        },
        {
          id: 2,
          column1: 'd',
          many__table1Id: 2,
          many__table2Id: 2,
          many__column1: 'e',
          many__table2__id: 2,
          many__table2__column1: 'f'
        }
      ]

      let criteria = {
        id: 1,
        column1: 'a',
        many: {
          column1: 'b',
          table2: {
            column1: 'c'
          }
        }
      }

      let instances = orm.rowsToInstances(rows, criteria, 'Table1')

      // expect(instances.length).to.equal(2)
      expect(instances[0]).to.be.instanceOf(Table1)
      expect(instances[0].many).to.be.instanceOf(Array)
      expect(instances[0].many[0]).to.be.instanceOf(Many)
      expect(instances[0].many[0].table2).to.be.instanceOf(Table2)
      expect(instances[0]).to.deep.equal({ id: 1, column1: 'a', many: [{ table1Id: 1, table2Id: 1, column1: 'b', table2: { id: 1, column1: 'c' }}]})
      expect(instances[1]).to.be.instanceOf(Table1)
      expect(instances[1].many).to.be.instanceOf(Array)
      expect(instances[1].many[0]).to.be.instanceOf(Many)
      expect(instances[1].many[0].table2).to.be.instanceOf(Table2)
      expect(instances[1]).to.deep.equal({ id: 2, column1: 'd', many: [{ table1Id: 2, table2Id: 2, column1: 'e', table2: { id: 2, column1: 'f' }}]})
    })
  })
})

class Table1 {
  id?: number
  column1?: string
  many?: Many[]
}

class Table2 {
  id?: number
  column1?: string
  many?: Many[]
}

class Many {
  table1Id?: number
  table2Id?: number
  column1?: string

  table1?: Table1
  table2?: Table2
}

const schema = {
  'TableAB': {
    name: 'TableAB',
    columns: [ 'a', 'b' ],
    rowToInstance: (row: any, alias?: string) => {}
  },
  
  'Table1': {
    name: 'Table1',
    columns: [ 'id', 'column1' ],
    many: {
      oneToMany: {
        thisId: 'id',
        otherTable: 'TableMany',
        otherId: 'table1Id'
      }
    },
    rowToInstance: (row: any, alias?: string) => {
      let table1 = new Table1
      table1.id = row[alias + 'id']
      table1.column1 = row[alias + 'column1']
      return table1
    }
  },
  
  'Table2': {
    name: 'Table2',
    columns: [ 'id', 'column1' ],
    many: {
      oneToMany: {
        thisId: 'id',
        otherTable: 'TableMany',
        otherId: 'table2Id'
      }
    },
    rowToInstance: (row: any, alias?: string) => {
      let table2 = new Table2
      table2.id = row[alias + 'id']
      table2.column1 = row[alias + 'column1']
      return table2      
    }
  },

  'TableMany': {
    name: 'TableMany',
    columns: [ 'table1Id', 'table2Id', 'column1' ],
    table1: {
      manyToOne: {
        thisId: 'table1Id',
        otherTable: 'Table1',
        otherId: 'id'
      }
    },
    table2: {
      manyToOne: {
        thisId: 'table2Id',
        otherTable: 'Table2',
        otherId: 'id'
      }
    },
    rowToInstance: (row: any, alias?: string) => {
      let many = new Many
      many.table1Id = row[alias + 'table1Id']
      many.table2Id = row[alias + 'table2Id']
      many.column1 = row[alias + 'column1']
      return many
    }
  }
} as Schema