import { Schema } from '../src/Schema'

export class Object1 {
  id?: number
  property1?: string
  property2?: number
  many?: ManyObjects[]
  object41s?: Object4[]
  object42s?: Object4[]
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

export class Object5 {
  id?: number
  object5Id?: number
  object6Id?: number
  object5?: Object5
  object6?: Object6
}

export class Object6 {
  object5Id1?: number
  object5Id2?: number
  object51?: Object5
  object52?: Object5
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
      'id': { property: 'id', id: true, generated: true },
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
      },
      object41s: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table4',
        otherId: 'table1_id1'
      },
      object42s: {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'table4',
        otherId: 'table1_id2'
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
      'id': { property: 'id', id: true, generated: true },
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
      'id': { property: 'id', id: true, generated: true },
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
      'table1_id1': { property: 'object1Id1', id: true, generated: false },
      'table1_id2': { property: 'object1Id2', id: true, generated: false }
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

  'table5': {
    columns: {
      'id': { property: 'id', id: true, generated: true },
      'table5_id': 'object5Id',
      'table6_id': 'object6Id'
    },
    relationships: {
      object5: {
        manyToOne: true,
        thisId: 'table5_id',
        otherTable: 'table5',
        otherId: 'id',
        delete: true
      },
      object6: {
        oneToOne: 'object5',
        thisId: 'table6_id',
        otherTable: 'table6',
        otherId: 'table5_id1'
      }
    },
    rowToInstance: (row: any) => {
      let obj5 = new Object5
      obj5.id = row.id
      obj5.object5Id = row.table3_id
      return obj5
    },
    instanceToRow: (object5: Object5) => {
      return {
        id: object5.id,
        table5_id: object5.object5Id
      }
    }
  },

  'table6': {
    columns: {
      'table5_id1': { property: 'object5Id1', id: true, generated: false },
      'table5_id2': { property: 'object5Id2', id: true, generated: false }
    },
    relationships: {
      object51: {
        oneToOne: 'object6',
        thisId: 'table5_id1',
        otherTable: 'table5',
        otherId: 'id'
      },
      object52: {
        manyToOne: true,
        thisId: 'table5_id2',
        otherTable: 'table5',
        otherId: 'id'
      }
    },
    rowToInstance: (row: any) => {
      let obj6 = new Object6
      obj6.object5Id1 = row.table5_id1
      obj6.object5Id2 = row.table5_id2
      return obj6
    },
    instanceToRow: (object6: Object6) => {
      return {
        table5_id1: object6.object5Id1,
        table5_id2: object6.object5Id2
      }
    }
  },

  'table_many': {
    columns: {
      'table1_id': { property: 'object1Id', id: true, generated: false },
      'table2_id': { property: 'object2Id', id: true, generated: false },
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