import { Schema } from '../src/Schema'

export class Object1 {
  id?: number
  property1?: string
  property2?: number
  property3?: Date
  manyToOneId?: number
  manyToOneRecursiveId?: number
  oneToOneId?: number
  oneToOneRecursiveId?: number
  oneToManyRescursiveId?: number

  manyToOne?: Object2
  manyToOneRecursive?: Object1
  oneToOne?: Object2
  oneToOneRecursive?: Object1
  oneToMany?: Object2[]
  oneToManyRecursive?: Object1[]
  oneToManyRecursiveOne?: Object1
  manyToMany?: ManyToMany[]
  manyToManyRecursive?: ManyToManyRecursive[]
}

export class Object2 {
  id?: string
  property1?: string
  property2?: number
  property3?: Date
  oneToOneId?: number
  oneToManyId?: number
  
  oneToOne?: Object1
  oneToManyOne?: Object1
  manyToMany?: ManyToMany[]
}

export class ManyToMany {
  object1Id?: number
  object2Id?: string
  property1?: string
  property2?: number
  property3?: Date

  object1?: Object1
  object2?: Object2
}

export class ManyToManyRecursive {
  object11Id?: number
  object12Id?: number
  property1?: string
  property2?: number
  property3?: Date

  object11?: Object1
  object12?: Object1
}

export const schema = {
  'table1': {
    columns: {
      'id': { property: 'id', primaryKey: true, generated: true },
      'column1': 'property1',
      'column2': 'property2',
      'column3': 'property3',
      'many_to_one_id': 'manyToOneId',
      'many_to_one_recursive_id': 'manyToOneRecursiveId',
      'one_to_one_id': 'oneToOneId',
      'one_to_one_recursive_id': 'oneToOneRecursiveId',
      'one_to_many_recursive_id': 'oneToManyRecursiveId'
    },
    relationships: {
      manyToOne: {
        manyToOne: true,
        thisId: 'many_to_one_id',
        otherTable: 'table2',
        otherId: 'id'
      },
      manyToOneRecursive: {
        manyToOne: true,
        thisId: 'many_to_one_recursive_id',
        otherTable: 'table1',
        otherId: 'id'
      },
      oneToOne: {
        manyToOne: true,
        thisId: 'one_to_one_id',
        otherTable: 'table2',
        otherId: 'id',
        otherRelationship: 'oneToOne'
      },
      oneToOneRecursive: {
        manyToOne: true,
        thisId: 'one_to_one_recursive_id',
        otherTable: 'table1',
        otherId: 'id',
        otherRelationship: 'oneToOneRecursive'
      },
      oneToMany: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table2',
        otherId: 'one_to_many_id'
      },
      oneToManyRecursive: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table1',
        otherId: 'one_to_many_recursive_id'
      },
      oneToManyRecursiveOne: {
        manyToOne: true,
        thisId: 'one_to_many_recursive_id',
        otherTable: 'table1',
        otherId: 'id'
      },
      manyToMany: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'many_to_many',
        otherId: 'table1_id'
      },
      manyToManyRecursive: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'many_to_many_recursive',
        otherId: 'table11_id'
      }
    },
    newInstance: () => new Object1
  },
  
  'table2': {
    columns: {
      'id': { property: 'id', primaryKey: true },
      'column1': 'property1',
      'column2': 'property2',
      'column3': 'property3',
      'one_to_one_id': 'oneToOneId',
      'one_to_many_id': 'oneToManyId'
    },
    relationships: {
      oneToOne: {
        manyToOne: true,
        thisId: 'one_to_one_id',
        otherTable: 'table1',
        otherId: 'id',
        otherRelationship: 'oneToOne'
      },
      oneToManyOne: {
        manyToOne: true,
        thisId: 'one_to_many_id',
        otherTable: 'table1',
        otherId: 'id'
      },
      manyToMany: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'many_to_many',
        otherId: 'table2_id'
      }
    },
    newInstance: () => new Object2
  },

  'many_to_many': {
    columns: {
      'table1_id': { property: 'object1Id', primaryKey: true },
      'table2_id': { property: 'object2Id', primaryKey: true },
      'column1': 'property1',
      'column2': 'property2',
      'column3': 'property3'
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
      }
    },
    newInstance: () => new ManyToMany
  },

  'many_to_many_recursive': {
    columns: {
      'table11_id': { property: 'object11Id', primaryKey: true },
      'table12_id': { property: 'object12Id', primaryKey: true },
      'column1': 'property1',
      'column2': 'property2',
      'column3': 'property3'
    },
    relationships: {
      object11: {
        manyToOne: true,
        thisId: 'table11_id',
        otherTable: 'table1',
        otherId: 'id'
      },
      object12: {
        manyToOne: true,
        thisId: 'table12_id',
        otherTable: 'table1',
        otherId: 'id'
      }
    },
    newInstance: () => new ManyToManyRecursive
  }
} as Schema