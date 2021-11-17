import { Schema } from '../src/Schema'

export class Object1 {
  id?: number
  property1?: string
  property2?: number
  object1Id?: number
  object2Id?: number

  manyObjects?: ManyObject[]
  object1?: Object1
  object2?: Object2
}

export class Object2 {
  id?: string
  property1?: string
  object1Id?: number|null
  
  object1?: Object1
  manyObjects?: ManyObject[]
}

export class ManyObject {
  object1Id?: number
  object2Id?: string
  property1?: string
  object1Id2?: number|null

  object1?: Object1
  object2?: Object2
  object12?: Object1
}

export const schema = {
  'table1': {
    columns: {
      'id': { property: 'id', primaryKey: true },
      'column1': 'property1',
      'column2': 'property2',
      'table1_id': 'object1Id',
      'table2_id': 'object2Id'
    },
    relationships: {
      manyObjects: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table_many',
        otherId: 'table1_id',
        delete: true
      },
      object1: {
        manyToOne: true,
        thisId: 'table1_id',
        otherTable: 'table1',
        otherId: 'id',
        otherRelationship: 'object1',
        delete: true
      },
      object2: {
        manyToOne: true,
        thisId: 'table2_id',
        otherTable: 'table2',
        otherId: 'id',
        otherRelationship: 'object1'
      }
    },
    newInstance: () => new Object1
  },
  
  'table2': {
    columns: {
      'id': { property: 'id', primaryKey: true },
      'column1': 'property1',
      'table1_id': 'object1Id'
    },
    relationships: {
      object1: {
        manyToOne: true,
        thisId: 'table1_id',
        otherTable: 'table1',
        otherId: 'id',
        otherRelationship: 'object2'
      },
      manyObjects: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table_many',
        otherId: 'table2_id',
        delete: true
      }
    },
    newInstance: () => new Object2
  },

  'table_many': {
    columns: {
      'table1_id': { property: 'object1Id', primaryKey: true },
      'table2_id': { property: 'object2Id', primaryKey: true },
      'column1': 'property1',
      'table1_id2': 'object1Id2'
    },
    relationships: {
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
      object12: {
        manyToOne: true,
        thisId: 'table1_id2',
        otherTable: 'table1',
        otherId: 'id'
      }
    },
    newInstance: () => new ManyObject
  }
} as Schema