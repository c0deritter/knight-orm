import { expect } from 'chai'
import 'mocha'
import { Schema } from '../src/Schema'
import { getPropertyName, instanceCriteriaToRowCriteria, instanceToDeleteCriteria, instanceToUpdateCriteria, isId, relationshipsOnly } from '../src/util'

describe('util', function() {
  describe('isId', function() {
    it('should return false if the column schema is of type string', function() {
      expect(isId('a')).to.be.false
    })
  
    it('should return false if the column schema is of type object but with id property set to false', function() {
      expect(isId({ property: 'a', id: false })).to.be.false
    })
  
    it('should return true if the column schema is of type object and the id property set to true', function() {
      expect(isId({ property: 'a', id: true })).to.be.true
    })
  })

  describe('getPropertyName', function() {
    it('should return the string which in this case is the property', function() {
      expect(getPropertyName('a')).to.equal('a')
    })

    it('should return the property from the column schema object', function() {
      expect(getPropertyName({ property: 'a', id: false })).to.equal('a')
    })
  })

  describe('relationshipsOnly', function() {
    it('should return an object containing only the relationships', function() {
      expect(relationshipsOnly({
        name: 'table',
        columns: { 'id': 'id' },
        instanceToRow: (instance) => {},
        rowToInstance: (row, alias) => {},
        relationship1: {
          oneToMany: true,
          property: 'relation1',
          thisId: 'id',
          otherTable: 'other_table',
          otherId: 'other_id'
        },
        relationship2: {
          manyToOne: true,
          property: 'relation2',
          thisId: 'id',
          otherTable: 'other_table',
          otherId: 'other_id'
        },
        otherFunction: () => {}
      })).to.deep.equal({
        relationship1: {
          oneToMany: true,
          property: 'relation1',
          thisId: 'id',
          otherTable: 'other_table',
          otherId: 'other_id'
        },
        relationship2: {
          manyToOne: true,
          property: 'relation2',
          thisId: 'id',
          otherTable: 'other_table',
          otherId: 'other_id'
        }
      })  
    })
  })

  describe('instanceCriteriaToRowCriteria', function() {
    it('should convert instance criteria to row criteria', function() {
      let instanceCriteria = {
        property1: 'a',
        property2: { operator: '>', value: 1 },
        many: {
          property1: { operator: 'LIKE', value: '%b%' },
          object2: {
            property1: 'c'
          }
        }
      }

      let rowCriteria = instanceCriteriaToRowCriteria(instanceCriteria, 'table1', schema)

      expect(rowCriteria).to.deep.equal({
        column1: 'a',
        column2: { operator: '>', value: 1 },
        many: {
          column1: { operator: 'LIKE', value: '%b%' },
          object2: {
            column1: 'c'
          }
        }
      })
    })
  })

  describe('instanceToUpdateCriteria', function() {
    it('should convert an instance to update criteria', function() {
      let table1 = new Object1
      table1.id = 1
      table1.property1 = 'a'
      table1.property2 = 1
      table1.many = [ new ManyObjects ]
      table1.many[0].property1 = 'b'
      
      let criteria = instanceToUpdateCriteria(table1, schema['table1'])

      expect(criteria).to.deep.equal({
        id: 1,
        set: {
          column1: 'a',
          column2: 1
        }
      })
    })
  })

  describe('instanceToDeleteCriteria', function() {
    it('should convert an instance to update criteria', function() {
      let tableMany = new ManyObjects
      tableMany.object1Id = 1
      tableMany.object2Id = '2'
      tableMany.property1 = 'a'
      tableMany.object1 = new Object1
      tableMany.object1.id = 1
      tableMany.object1.property1 = 'a'
      tableMany.object1.property2 = 1
      tableMany.object1.many = [ tableMany ]
      tableMany.object2 = new Object2
      
      let criteria = instanceToDeleteCriteria(tableMany, schema['table_many'])

      expect(criteria).to.deep.equal({
        table1_id: 1,
        table2_id: '2'
      })
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