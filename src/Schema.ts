export interface Schema {
  [ tableName: string ]: Table
}

export interface Table {
  name: string
  columns: string[]
  [ relationship: string ]: any|Relationship
  rowToInstance: (row: any, alias?: string) => any
}

export interface Relationship {
  oneToMany?: {
    thisId: any
    otherTable: string
    otherId: any  
  },
  manyToOne?: {
    thisId: any
    otherTable: string
    otherId: any  
  }
}

export function relationshipsOnly(table: Table): {[ relationship: string ]: Relationship } {
  let relationships: {[ relationship: string ]: any|Relationship } = {}

  for (let property of Object.keys(table)) {
    if (property == 'name' || property == 'columns' || property == 'rowToInstance') {
      continue
    }

    relationships[property] = table[property]
  }

  return relationships
}