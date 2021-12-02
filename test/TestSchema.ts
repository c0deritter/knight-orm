import { Schema } from '../src/Schema'

export class Object1 {
  id?: number
  property1?: string
  property2?: number
  property3?: Date
  manyToOneObject1Id?: number
  manyToOneObject2Id?: number
  oneToOneObject1Id?: number
  oneToOneObject2Id?: number
  oneToManyObject1ManyToOneId?: number

  manyToOneObject1?: Object1
  manyToOneObject2?: Object2
  oneToOneObject1?: Object1
  oneToOneObject2?: Object2
  oneToManyObject1?: Object1[]
  oneToManyObject2?: Object2[]
  oneToManyObject1ManyToOne?: Object1
  manyToManyObject1?: ManyToManyObject1[]
  manyToManyObject2?: ManyToManyObject2[]
}

export class Object2 {
  id?: string
  property1?: string
  property2?: number
  property3?: Date
  oneToOneObject1Id?: number
  oneToManyObject2ManyToOneId?: number
  
  oneToOneObject1?: Object1
  oneToManyObject2ManyToOne?: Object1
  manyToManyObject2?: ManyToManyObject2[]
}

export class ManyToManyObject1 {
  object1Id1?: number
  object1Id2?: number
  property1?: string
  property2?: number
  property3?: Date

  object11?: Object1
  object12?: Object1
}

export class ManyToManyObject2 {
  object1Id?: number
  object2Id?: string
  property1?: string
  property2?: number
  property3?: Date

  object1?: Object1
  object2?: Object2
}

export const schema = {
  'table1': {
    columns: {
      'id': { property: 'id', primaryKey: true, generated: true },
      'column1': 'property1',
      'column2': 'property2',
      'column3': 'property3',
      'many_to_one_object1_id': 'manyToOneObject1Id',
      'many_to_one_object2_id': 'manyToOneObject2Id',
      'one_to_one_object1_id': 'oneToOneObject1Id',
      'one_to_one_object2_id': 'oneToOneObject2Id',
      'one_to_many_object1_many_to_one_id': 'oneToManyObject1ManyToOneId'
    },
    relationships: {
      manyToOneObject1: {
        manyToOne: true,
        thisId: 'many_to_one_object1_id',
        otherTable: 'table1',
        otherId: 'id'
      },
      manyToOneObject2: {
        manyToOne: true,
        thisId: 'many_to_one_object2_id',
        otherTable: 'table2',
        otherId: 'id'
      },
      oneToOneObject1: {
        manyToOne: true,
        thisId: 'one_to_one_object1_id',
        otherTable: 'table1',
        otherId: 'id',
        otherRelationship: 'oneToOneObject1'
      },
      oneToOneObject2: {
        manyToOne: true,
        thisId: 'one_to_one_object2_id',
        otherTable: 'table2',
        otherId: 'id',
        otherRelationship: 'oneToOneObject1'
      },
      oneToManyObject1: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table1',
        otherId: 'one_to_many_object1_many_to_one_id'
      },
      oneToManyObject2: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table2',
        otherId: 'one_to_many_object2_many_to_one_id'
      },
      oneToManyObject1ManyToOne: {
        manyToOne: true,
        thisId: 'one_to_many_object1_many_to_one_id',
        otherTable: 'table1',
        otherId: 'id'
      },
      manyToManyObject1: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'many_to_many_table1',
        otherId: 'table1_id1'
      },
      manyToManyObject2: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'many_to_many_table2',
        otherId: 'table1_id'
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
      'one_to_one_object1_id': 'oneToOneObject1Id',
      'one_to_many_object2_many_to_one_id': 'oneToManyObject2ManyToOneId'
    },
    relationships: {
      oneToOneObject1: {
        manyToOne: true,
        thisId: 'one_to_one_object1_id',
        otherTable: 'table1',
        otherId: 'id',
        otherRelationship: 'oneToOneObject2'
      },
      oneToManyObject2ManyToOne: {
        manyToOne: true,
        thisId: 'one_to_many_object2_many_to_one_id',
        otherTable: 'table1',
        otherId: 'id'
      },
      manyToManyObject2: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'many_to_many_table2',
        otherId: 'table2_id'
      }
    },
    newInstance: () => new Object2
  },

  'many_to_many_table1': {
    columns: {
      'table1_id1': { property: 'object11Id', primaryKey: true },
      'table1_id2': { property: 'object12Id', primaryKey: true },
      'column1': 'property1',
      'column2': 'property2',
      'column3': 'property3'
    },
    relationships: {
      object11: {
        manyToOne: true,
        thisId: 'table1_id1',
        otherTable: 'table1',
        otherId: 'id'
      },
      object12: {
        manyToOne: true,
        thisId: 'table1_id2',
        otherTable: 'table1',
        otherId: 'id'
      }
    },
    newInstance: () => new ManyToManyObject1
  },

  'many_to_many_table2': {
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
    newInstance: () => new ManyToManyObject2
  }
} as Schema