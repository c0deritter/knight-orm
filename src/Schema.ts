export interface Schema {
  [ tableName: string ]: Table
}

export interface Table {
  name: string
  columns: {[ name: string ]: string|{ property: string, id: boolean }}
  [ relationship: string ]: any|Relationship
  rowToInstance: (row: any) => any
  instanceToRow: (instance: any) => any
}

export interface Relationship {
  oneToMany?: boolean
  manyToOne?: boolean
  oneToOne?: string
  property: string
  thisId: any
  otherTable: string
  otherId: any
  delete?: boolean
}

export function isId(columnSchema: string | { property: string, id: boolean }): boolean {
  if (typeof columnSchema == 'string') {
    return false
  }

  return columnSchema.id
}

export function getRelationshipNameByColumn(columnName: string, table: Table): string|undefined {
  for (let relationshipName of getRelationshipNames(table)) {
    let relationship = table[relationshipName] as Relationship

    if (relationship.thisId == columnName) {
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

export function getRelationshipNames(table: Table): string[] {
  let names: string[] = []

  for (let property of Object.keys(table)) {
    if (property == 'name' || property == 'columns' || typeof table[property] == 'function') {
      continue
    }

    names.push(property.toString())
  }

  return names
}
