import { expect } from 'chai'
import 'mocha'
import { Schema } from '../src/Schema'
import { SqlOrm } from '../src/SqlOrm'

describe('SqlOrm', function() {
  describe('buildSelectQuery', function() {
    it('should handle a simple select query', function() {
      let orm = new SqlOrm(schema)
      let criteria = { column1: 'a', column2: 1 }
      let query = orm.buildSelectQuery('table1', criteria)
      expect(query.mysql()).to.equal('SELECT table1.id table1__id, table1.column1 table1__column1, table1.column2 table1__column2 FROM table1 table1 WHERE table1.column1 = ? AND table1.column2 = ?;')
    })
  
    it('should handle inter table relationships', function() {
      let orm = new SqlOrm(schema)
  
      let criteria = {
        id: 1,
        column1: 'a',
        many: {
          column1: 'b',
          object2: {
            column1: 'c'
          }
        }
      }
  
      let query = orm.buildSelectQuery('table1', criteria)
  
      expect(query._selects.length).to.equal(8)
      expect(query._selects[0]).to.equal('table1.id table1__id')
      expect(query._selects[1]).to.equal('table1.column1 table1__column1')
      expect(query._selects[2]).to.equal('table1.column2 table1__column2')
      expect(query._selects[3]).to.equal('table1__many.table1_id table1__many__table1_id')
      expect(query._selects[4]).to.equal('table1__many.table2_id table1__many__table2_id')
      expect(query._selects[5]).to.equal('table1__many.column1 table1__many__column1')
      expect(query._selects[6]).to.equal('table1__many__object2.id table1__many__object2__id')
      expect(query._selects[7]).to.equal('table1__many__object2.column1 table1__many__object2__column1')
  
      expect(query.mysql()).to.equal('SELECT table1.id table1__id, table1.column1 table1__column1, table1.column2 table1__column2, table1__many.table1_id table1__many__table1_id, table1__many.table2_id table1__many__table2_id, table1__many.column1 table1__many__column1, table1__many__object2.id table1__many__object2__id, table1__many__object2.column1 table1__many__object2__column1 FROM table1 table1 INNER JOIN table_many table1__many ON table1.id = table1__many.table1_id INNER JOIN table2 table1__many__object2 ON table1__many.table2_id = table1__many__object2.id WHERE table1.id = ? AND table1.column1 = ? AND table1__many.column1 = ? AND table1__many__object2.column1 = ?;')
    })
  })

  describe('rowsToInstances', function() {
    it('should create objects from a simple select query', function() {
      let orm = new SqlOrm(schema)

      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__somethingElse: '?'
        },
        {
          table1__id: 2,
          table1__column1: 'b',
          table1__column2: 2,
          table1__somethingElse: '?'
        }
      ]

      let criteria = { a: 'a', b: 1 }
      let instances = orm.rowsToInstances('table1', rows, criteria)

      expect(instances.length).to.equal(2)
      expect(instances[0]).to.be.instanceOf(Object1)
      expect(instances[0]).to.deep.equal({ id: 1, property1: 'a', property2: 1 })
      expect(instances[1]).to.be.instanceOf(Object1)
      expect(instances[1]).to.deep.equal({ id: 2, property1: 'b', property2: 2 })
    })

    it('should create objects from a simple select query', function() {
      let orm = new SqlOrm(schema)

      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__many__table1_id: 1,
          table1__many__table2_id: 1,
          table1__many__column1: 'b',
          table1__many__object2__id: 1,
          table1__many__object2__column1: 'c'
        },
        {
          table1__id: 2,
          table1__column1: 'd',
          table1__column2: 2,
          table1__many__table1_id: 2,
          table1__many__table2_id: 2,
          table1__many__column1: 'e',
          table1__many__object2__id: 2,
          table1__many__object2__column1: 'f'
        }
      ]

      let criteria = {
        id: 1,
        column1: 'a',
        many: {
          column1: 'b',
          object2: {
            column1: 'c'
          }
        }
      }

      let instances = orm.rowsToInstances('table1', rows, criteria)

      expect(instances.length).to.equal(2)
      expect(instances[0]).to.be.instanceOf(Object1)
      expect(instances[0].many).to.be.instanceOf(Array)
      expect(instances[0].many[0]).to.be.instanceOf(ManyObjects)
      expect(instances[0].many[0].object2).to.be.instanceOf(Object2)
      expect(instances[0]).to.deep.equal({ id: 1, property1: 'a', property2: 1, many: [{ object1Id: 1, object2Id: 1, property1: 'b', object2: { id: 1, property1: 'c' }}]})
      expect(instances[1]).to.be.instanceOf(Object1)
      expect(instances[1].many).to.be.instanceOf(Array)
      expect(instances[1].many[0]).to.be.instanceOf(ManyObjects)
      expect(instances[1].many[0].object2).to.be.instanceOf(Object2)
      expect(instances[1]).to.deep.equal({ id: 2, property1: 'd', property2: 2, many: [{ object1Id: 2, object2Id: 2, property1: 'e', object2: { id: 2, property1: 'f' }}]})
    })
  })
})

class Object1 {
  id?: number
  property1?: string
  property2?: number
  many?: ManyObjects[]
}

class Object2 {
  id?: string
  property1?: string
  many?: ManyObjects[]
}

class ManyObjects {
  object1Id?: number
  object2Id?: string
  property1?: string

  object1?: Object1
  object2?: Object2
}

const schema = {
  'table1': {
    name: 'table1',
    columns: {
      'id': { property: 'id', id: true },
      'column1': 'property1',
      'column2': 'property2'
    },
    many: {
      oneToMany: true,
      thisId: 'id',
      otherTable: 'table_many',
      otherId: 'table1_id'
    },
    rowToInstance: (row: any, alias: string) => {
      let obj1 = new Object1
      obj1.id = row[alias + 'id']
      obj1.property1 = row[alias + 'column1']
      obj1.property2 = row[alias + 'column2']
      return obj1
    },
    instanceToRow: (object1: Object1) => {
      return {
        id: object1.id,
        column1: object1.property1,
        column2: object1.property2
      }
    }
  },
  
  'table2': {
    name: 'table2',
    columns: {
      'id': { property: 'id', id: true },
      'column1': 'property1'
    },
    many: {
      oneToMany: true,
      thisId: 'id',
      otherTable: 'table_many',
      otherId: 'table2_id'
    },
    rowToInstance: (row: any, alias: string) => {
      let obj2 = new Object2
      obj2.id = row[alias + 'id']
      obj2.property1 = row[alias + 'column1']
      return obj2      
    },
    instanceToRow: (object2: Object2) => {
      return {
        id: object2.id,
        column1: object2.property1
      }
    }
  },

  'table_many': {
    name: 'table_many',
    columns: {
      'table1_id': { property: 'object1Id', id: true },
      'table2_id': { property: 'object2Id', id: true },
      'column1': 'property1'
    },
    object1: {
      manyToOne: true,
      thisId: 'table1_id',
      otherTable: 'table1',
      otherId: 'id'
    },
    object2: {
      manyToOne: true,
      thisId: 'table2_id',
      otherTable: 'table2',
      otherId: 'id'
    },
    rowToInstance: (row: any, alias: string) => {
      let many = new ManyObjects
      many.object1Id = row[alias + 'table1_id']
      many.object2Id = row[alias + 'table2_id']
      many.property1 = row[alias + 'column1']
      return many
    },
    instanceToRow: (manyObjects: ManyObjects) => {
      return {
        table1_id: manyObjects.object1Id,
        table2_id: manyObjects.object2Id,
        column1: manyObjects.property1
      }
    }
  }
} as Schema