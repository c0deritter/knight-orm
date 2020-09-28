export interface Schema {
  [ tableName: string ]: Table
}

export interface Table {
  columns: { [name: string]: string | { property: string, id: boolean } }
  relationships: { [relationship: string]: Relationship }
  rowToInstance: (row: any) => any
  instanceToRow: (instance: any) => any
}

export interface Relationship {
  oneToMany?: boolean
  manyToOne?: boolean
  oneToOne?: string
  thisId: any
  otherTable: string
  otherId: any
  delete?: boolean
}

export function getIdColumns(table: Table): string[] {
  let idColumns: string[] = []

  for (let column of Object.keys(table.columns)) {
    if (isIdColumn(table.columns[column])) {
      idColumns.push(column)
    }
  }

  return idColumns
}

export function isIdColumn(column: string | { property: string, id: boolean }): boolean {
  if (typeof column == 'string') {
    return false
  }

  return column.id
}

export function getRelationshipNameByColumn(column: string, table: Table): string|undefined {
  for (let relationshipName of Object.keys(table.relationships)) {
    let relationship = table.relationships[relationshipName]

    if (relationship.thisId == column) {
      return relationshipName
    }
  }
}

export function getPropertyName(columnSchema: string | { property: string, id: boolean }): string {
  if (typeof columnSchema == 'string') {
    return columnSchema
  }

  return columnSchema.property
}
