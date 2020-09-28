import { Schema } from '../src/Schema'

export class Object1 {
  id?: number
  property1?: string
  property2?: number
  many?: ManyObjects[]
}

export class Object2 {
  id?: string
  property1?: string
  many?: ManyObjects[]
}

export class Object3 {
  id?: number
  property1?: string
  object3Id?: string
  object3?: Object3
}

export class Object4 {
  object1Id1?: number
  object1Id2?: number
  object11?: Object1
  object12?: Object1
}

export class ManyObjects {
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
      'id': { property: 'id', id: true },
      'column1': 'property1',
      'column2': 'property2'
    },
    relationships: {
      many: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table_many',
        otherId: 'table1_id',
        delete: true
      }
    },
    rowToInstance: (row: any) => {
      let obj1 = new Object1
      obj1.id = row.id
      obj1.property1 = row.column1
      obj1.property2 = row.column2
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
    columns: {
      'id': { property: 'id', id: true },
      'column1': 'property1'
    },
    relationships: {
      many: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table_many',
        otherId: 'table2_id',
        delete: true
      }  
    },
    rowToInstance: (row: any) => {
      let obj2 = new Object2
      obj2.id = row.id
      obj2.property1 = row.column1
      return obj2      
    },
    instanceToRow: (object2: Object2) => {
      return {
        id: object2.id,
        column1: object2.property1
      }
    }
  },

  'table3': {
    columns: {
      'id': { property: 'id', id: true },
      'column1': 'property1',
      'table3_id': 'object3Id'
    },
    relationships: {
      object3: {
        oneToOne: 'object3',
        thisId: 'table3_id',
        otherTable: 'table3',
        otherId: 'id',
        delete: true
      }  
    },
    rowToInstance: (row: any) => {
      let obj3 = new Object3
      obj3.id = parseInt(row.id)
      obj3.property1 = row.column1
      obj3.object3Id = row.table3_id
      return obj3      
    },
    instanceToRow: (object3: Object3) => {
      return {
        id: object3.id,
        column1: object3.property1,
        table3_id: object3.object3Id
      }
    }
  },

  'table4': {
    columns: {
      'table1_id1': { property: 'object1Id1', id: true },
      'table1_id2': { property: 'object1Id2', id: true }
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
    rowToInstance: (row: any) => {
      let obj4 = new Object4
      obj4.object1Id1 = row.table1_id1
      obj4.object1Id2 = row.table1_id2
      return obj4      
    },
    instanceToRow: (object4: Object4) => {
      return {
        table1_id1: object4.object1Id1,
        table1_id2: object4.object1Id2
      }
    }
  },

  'table_many': {
    columns: {
      'table1_id': { property: 'object1Id', id: true },
      'table2_id': { property: 'object2Id', id: true },
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
    rowToInstance: (row: any) => {
      let many = new ManyObjects
      many.object1Id = row.table1_id
      many.object2Id = row.table2_id
      many.property1 = row.column1
      many.object1Id2 = row.table1_id2
      return many
    },
    instanceToRow: (manyObjects: ManyObjects) => {
      return {
        table1_id: manyObjects.object1Id,
        table2_id: manyObjects.object2Id,
        column1: manyObjects.property1,
        table1_id2: manyObjects.object1Id2
      }
    }
  }
} as Schema