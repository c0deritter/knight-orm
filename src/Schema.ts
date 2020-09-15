export interface Schema {
  [ tableName: string ]: Table
}

export interface Table {
  name: string
  columns: {[ name: string ]: string|{ property: string, id: boolean }}
  [ relationship: string ]: any|Relationship
  rowToInstance: (row: any, alias: string) => any
  instanceToRow: (instance: any) => any
}

export interface Relationship {
  oneToMany?: boolean
  manyToOne?: boolean
  property: string
  thisId: any
  otherTable: string
  otherId: any
}
