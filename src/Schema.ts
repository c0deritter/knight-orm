export interface Schema {
  [ tableName: string ]: Table
}

export interface Table {
  columns: {
    [name: string]: string | Column
  }

  relationships?: {
    [relationship: string]: Relationship
  }

  newInstance: () => any
  rowToInstance?: (row: any, instance: any) => any
  instanceToRow?: (instance: any, row: any) => any
}

export interface Column {
  property: string,
  primaryKey: boolean,
  generated?: boolean
}

export interface Relationship {
  oneToMany?: boolean
  manyToOne?: boolean
  thisId: any
  otherTable: string
  otherId: any
  otherRelationship?: string
}

export function getPrimaryKey(table: Table): string[] {
  // TODO: add caching
  let primaryKey: string[] = []

  for (let column of Object.keys(table.columns)) {
    if (isPrimaryKeyColumn(table, column)) {
      primaryKey.push(column)
    }
  }

  return primaryKey
}

export function getNotGeneratedPrimaryKeyColumns(table: Table): string[] {
  // TODO: add caching
  let notGenerated: string[] = []

  for (let column of Object.keys(table.columns)) {
    if (isNotGeneratedPrimaryKeyColumn(table, column)) {
      notGenerated.push(column)
    }
  }

  return notGenerated
}

export function isPrimaryKeyColumn(table: Table, columnName: string): boolean {
  // TODO: add caching
  let column = table.columns[columnName]

  if (column == undefined) {
    throw new Error(`Column '${columnName} not contained table`)
  }

  if (typeof column == 'string') {
    return false
  }

  if (typeof column == 'object' && column !== null && typeof column.primaryKey == 'boolean') {
    return column.primaryKey
  }

  return false
}

export function isGeneratedPrimaryKeyColumn(table: Table, columnName: string): boolean {
  // TODO: add caching
  let column = table.columns[columnName]

  if (column == undefined) {
    throw new Error(`Column '${columnName} not contained table`)
  }

  if (typeof column == 'string') {
    return false
  }

  if (typeof column == 'object' && column !== null) {
    return column.primaryKey === true && column.generated === true
  }

  return false
}

export function isNotGeneratedPrimaryKeyColumn(table: Table, columnName: string): boolean {
  // TODO: add caching
  let column = table.columns[columnName]

  if (column == undefined) {
    throw new Error(`Column '${columnName} not contained table`)
  }

  if (typeof column == 'string') {
    return false
  }

  if (typeof column == 'object' && column !== null) {
    return column.primaryKey === true && (column.generated == undefined || column.generated === false)
  }

  return false
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
export function getCorrespondingManyToOne(table: Table, columnName: string): string|undefined {
  if (table.columns[columnName] == undefined) {
    throw new Error(`Column '${columnName} not contained table`)
  }

  if (table.relationships == undefined) {
    return undefined
  }
  
  for (let relationshipName of Object.keys(table.relationships)) {
    let relationship = table.relationships[relationshipName]

    if (relationship.manyToOne === true && relationship.thisId == columnName) {
      return relationshipName
    }
  }
}

export function getPropertyName(table: Table, columnName: string): string|undefined {
  let propertySchema = table.columns[columnName]

  if (typeof propertySchema == 'string') {
    return propertySchema
  }

  else if (typeof propertySchema == 'object' && propertySchema !== null && 'property' in propertySchema) {
    return propertySchema.property
  }
}

export function getColumnName(table: Table, propertyName: string): string|undefined {
  let columnNames = Object.keys(table.columns)

  for (let columnName of columnNames) {
    let existingPropertyName = getPropertyName(table, columnName)

    if (existingPropertyName == propertyName) {
      return columnName
    }
  }
}
