import { Schema } from '../src/schema'

export class Object1 {
  id?: number
  property1?: string
  property2?: number
  property3?: Date
  manyToOneObject1Id?: number
  manyToOneObject2Id?: string
  oneToOneObject1Id?: number
  oneToOneObject2Id?: string
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

export const schema = new Schema

schema.addTable('table1',
  {
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
    newInstance: () => new Object1,
    instanceToRow: (object1: Object1, row: any) => {
      row['id'] = object1.id != null ? object1.id - 1 : row['id']
      row['column1'] = object1.property1 != null ? String.fromCharCode(object1.property1.charCodeAt(0) + 1) : object1.property1
      row['column2'] = object1.property2 != null ? object1.property2 + 1 : object1.property2
      row['column3'] = object1.property3 != null ? new Date(new Date(object1.property3).setFullYear(object1.property3.getFullYear() + 1)) : object1.property3
      row['many_to_one_object1_id'] = object1.manyToOneObject1Id != null ? object1.manyToOneObject1Id - 1 : object1.manyToOneObject1Id
      row['many_to_one_object2_id'] = object1.manyToOneObject2Id != null ? String.fromCharCode(object1.manyToOneObject2Id.charCodeAt(0) + 1) : object1.manyToOneObject2Id
      row['one_to_one_object1_id'] = object1.oneToOneObject1Id != null ? object1.oneToOneObject1Id - 1 : object1.oneToOneObject1Id
      row['one_to_one_object2_id'] = object1.oneToOneObject2Id != null ? String.fromCharCode(object1.oneToOneObject2Id.charCodeAt(0) + 1) : object1.oneToOneObject2Id
      row['one_to_many_object1_many_to_one_id'] = object1.oneToManyObject1ManyToOneId != null ? object1.oneToManyObject1ManyToOneId - 1 : object1.oneToManyObject1ManyToOneId
    },
    rowToInstance: (row: any, object1: Object1) => {
      object1.id = row['id'] + 1
      object1.property1 = row['column1'] != null ? String.fromCharCode(row['column1'].charCodeAt(0) - 1) : row['column1']
      object1.property2 = row['column2'] != null ? row['column2'] - 1 : row['column2']
      object1.property3 = row['column3'] != null ? new Date(new Date(row['column3']).setFullYear(row['column3'].getFullYear() - 1)) : row['column3']
      object1.manyToOneObject1Id = row['many_to_one_object1_id'] != null ? row['many_to_one_object1_id'] + 1 : row['many_to_one_object1_id']
      object1.manyToOneObject2Id = row['many_to_one_object2_id'] != null ? String.fromCharCode(row['many_to_one_object2_id'].charCodeAt(0) - 1) : row['many_to_one_object2_id']
      object1.oneToOneObject1Id = row['one_to_one_object1_id'] != null ? row['one_to_one_object1_id'] + 1 : row['one_to_one_object1_id']
      object1.oneToOneObject2Id = row['one_to_one_object2_id'] != null ? String.fromCharCode(row['one_to_one_object2_id'].charCodeAt(0) - 1) : row['one_to_one_object2_id']
      object1.oneToManyObject1ManyToOneId = row['one_to_many_object1_many_to_one_id'] != null ? row['one_to_many_object1_many_to_one_id'] + 1 : row['one_to_many_object1_many_to_one_id']
    }
  }
)

schema.addTable('table2', {
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
  newInstance: () => new Object2,
  instanceToRow: (object2: Object2, row: any) => {
    row['id'] = object2.id != null ? String.fromCharCode(object2.id.charCodeAt(0) + 1) : object2.id
    row['column1'] = object2.property1 != null ? String.fromCharCode(object2.property1.charCodeAt(0) + 1) : object2.property1
    row['column2'] = object2.property2 != null ? object2.property2 + 1 : object2.property2
    row['column3'] = object2.property3 != null ? new Date(new Date(object2.property3).setFullYear(object2.property3.getFullYear() + 1)) : object2.property3
    row['one_to_one_object1_id'] = object2.oneToOneObject1Id != null ? object2.oneToOneObject1Id - 1 : object2.oneToOneObject1Id
    row['one_to_many_object2_many_to_one_id'] = object2.oneToManyObject2ManyToOneId != null ? object2.oneToManyObject2ManyToOneId - 1 : object2.oneToManyObject2ManyToOneId
  },
  rowToInstance: (row: any, object2: Object2) => {
    object2.id = row['id'] != null ? String.fromCharCode(row['id'].charCodeAt(0) - 1) : row['id']
    object2.property1 = row['column1'] != null ? String.fromCharCode(row['column1'].charCodeAt(0) - 1) : row['column1']
    object2.property2 = row['column2'] != null ? row['column2'] - 1 : row['column2']
    object2.property3 = row['column3'] != null ? new Date(new Date(row['column3']).setFullYear(row['column3'].getFullYear() - 1)) : row['column3']
    object2.oneToOneObject1Id = row['one_to_one_object1_id'] != null ? row['one_to_one_object1_id'] + 1 : row['one_to_one_object1_id']
    object2.oneToManyObject2ManyToOneId = row['one_to_many_object2_many_to_one_id'] != null ? row['one_to_many_object2_many_to_one_id'] + 1 : row['one_to_many_object2_many_to_one_id']
  }
})

schema.addTable('many_to_many_table1', {
  columns: {
    'table1_id1': { property: 'object1Id1', primaryKey: true },
    'table1_id2': { property: 'object1Id2', primaryKey: true },
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
  newInstance: () => new ManyToManyObject1,
  instanceToRow: (manyToMany: ManyToManyObject1, row: any) => {
    row['table1_id1'] = manyToMany.object1Id1 != null ? manyToMany.object1Id1 - 1 : manyToMany.object1Id1
    row['table1_id2'] = manyToMany.object1Id2 != null ? manyToMany.object1Id2 - 1 : manyToMany.object1Id2
    row['column1'] = manyToMany.property1 != null ? String.fromCharCode(manyToMany.property1.charCodeAt(0) + 1) : manyToMany.property1
    row['column2'] = manyToMany.property2 != null ? manyToMany.property2 + 1 : manyToMany.property2
    row['column3'] = manyToMany.property3 != null ? new Date(new Date(manyToMany.property3).setFullYear(manyToMany.property3.getFullYear() + 1)) : manyToMany.property3
  },
  rowToInstance: (row: any, manyToMany: ManyToManyObject1) => {
    manyToMany.object1Id1 = row['table1_id1'] != null ? row['table1_id1'] + 1 : row['table1_id1']
    manyToMany.object1Id2 = row['table1_id2'] != null ? row['table1_id2'] + 1 : row['table1_id2']
    manyToMany.property1 = row['column1'] != null ? String.fromCharCode(row['column1'].charCodeAt(0) - 1) : row['column1']
    manyToMany.property2 = row['column2'] != null ? row['column2'] - 1 : row['column2']
    manyToMany.property3 = row['column3'] != null ? new Date(new Date(row['column3']).setFullYear(row['column3'].getFullYear() - 1)) : row['column3']
  }
})

schema.addTable('many_to_many_table2', {
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
  newInstance: () => new ManyToManyObject2,
  instanceToRow: (manyToMany: ManyToManyObject2, row: any) => {
    row['table1_id'] = manyToMany.object1Id != null ? manyToMany.object1Id - 1 : manyToMany.object1Id
    row['table2_id'] = manyToMany.object2Id != null ? String.fromCharCode(manyToMany.object2Id.charCodeAt(0) + 1) : manyToMany.object2Id
    row['column1'] = manyToMany.property1 != null ? String.fromCharCode(manyToMany.property1.charCodeAt(0) + 1) : manyToMany.property1
    row['column2'] = manyToMany.property2 != null ? manyToMany.property2 + 1 : manyToMany.property2
    row['column3'] = manyToMany.property3 != null ? new Date(new Date(manyToMany.property3).setFullYear(manyToMany.property3.getFullYear() + 1)) : manyToMany.property3
  },
  rowToInstance: (row: any, manyToMany: ManyToManyObject2) => {
    manyToMany.object1Id = row['table1_id'] != null ? row['table1_id'] + 1 : row['table1_id']
    manyToMany.object2Id = row['table2_id'] != null ? String.fromCharCode(row['table2_id'].charCodeAt(0) - 1) : row['table2_id']
    manyToMany.property1 = row['column1'] != null ? String.fromCharCode(row['column1'].charCodeAt(0) - 1) : row['column1']
    manyToMany.property2 = row['column2'] != null ? row['column2'] - 1 : row['column2']
    manyToMany.property3 = row['column3'] != null ? new Date(new Date(new Date(row['column3']).setFullYear(row['column3'].getFullYear() - 1))) : row['column3']
  }
})

schema.check()