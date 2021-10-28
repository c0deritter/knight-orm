export interface Schema {
  [ tableName: string ]: Table
}

export interface Table {
  columns: { [name: string]: string | { property: string, id: boolean } }
  relationships?: { [relationship: string]: Relationship }
  rowToInstance: (row: any) => any
  instanceToRow: (instance: any) => any
}

export interface Relationship {
  oneToMany?: boolean
  manyToOne?: boolean
  thisId: any
  otherTable: string
  otherId: any
  otherRelationship?: string
  delete?: boolean
}

export class SchemaClass {
  
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

export function isForeignKey(table: Table, columnName: string): boolean {
  let column = table.columns[columnName]

  if (column == undefined) {
    throw new Error(`Column '${columnName} not contained table`)
  }

  if (typeof column == 'string') {
    return false
  }

  if (table.relationships == undefined) {
    return false
  }

  for (let relationshipName of Object.keys(table.relationships)) {
    let relationship = table.relationships[relationshipName]
    
    if (relationship.thisId == columnName) {
      return true
    }
  }

  return false
}

/**
 * It returns the name of a relationship as defined in the schema, if the given column 
 * is part of a many-to-one relationship.
 * 
 * @param table The schema of a table in which the given column resides
 * @param columnName The column for which we want to find out if it is part of a many-to-one 
 * relationship
 * @returns The name of the relationship if the given column was part of any or undefined 
 * if the given column is not part of any relationship.
 */
export function getRelationshipNameOfColumn(table: Table, columnName: string): string|undefined {
  if (table.columns[columnName] == undefined) {
    throw new Error(`Column '${columnName} not contained table`)
  }

  if (table.relationships == undefined) {
    return undefined
  }
  
  for (let relationshipName of Object.keys(table.relationships)) {
    let relationship = table.relationships[relationshipName]

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
