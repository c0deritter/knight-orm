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

export function getGeneratedPrimaryKeyColumn(table: Table): string|undefined {
  // TODO: add caching
  for (let column of Object.keys(table.columns)) {
    if (isGeneratedPrimaryKeyColumn(table, column)) {
      return column
    }
  }
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

export function checkSchema(schema: Schema, tableName?: string) {
  if (typeof schema != 'object') {
    throw new Error('Given schema is not of type object. Declare interface \'Schema\' to prevent this error.')
  }

  let tableNames
  
  if (tableName) {
    tableNames = [ tableName ]
  }
  else {
    tableNames = Object.keys(schema)
  }

  for (let tableName of tableNames) {
    let table = schema[tableName]

    if (typeof table != 'object') {
      throw new Error(`Table '${tableName}'' was not assigned an object. Declare interface \'Table\' to prevent this error.`)
    }

    if (typeof table.columns != 'object' || table.columns === null) {
      throw new Error(`Columns of table '${tableName}' are either not present or null. Declare interface \'Table\' to prevent this error.`)
    }

    for (let columnName of Object.keys(table.columns)) {
      let column = table.columns[columnName]

      if (column == undefined) {
        throw new Error(`Value of column '${columnName}' of table '${tableName}' is undefined or null. Should be string or an object of type 'Column'.`)
      }

      let typeOf = typeof column

      if (typeOf != 'string' && typeOf != 'object') {
        throw new Error(`Value of column '${columnName}' of table '${tableName}' is neither of type string nor of type object. Should be string or an object of type 'Column'.`)
      }
    }

    if (table.relationships) {
      for (let relationshipName of Object.keys(table.relationships)) {
        let relationship = table.relationships[relationshipName]

        if (relationship == undefined) {
          throw new Error(`Value of relationship '${relationshipName}' of table '${tableName}' is undefined or null. Should be an object of type 'Relationship'.`)
        }
  
        let typeOf = typeof relationship
  
        if (typeOf != 'object') {
          throw new Error(`Value of relationship '${relationshipName}' of table '${tableName}' is not of type object. Should be an object of type 'Relationship'.`)
        }
  
        if (relationship.oneToMany !== true && relationship.manyToOne !== true) {
          throw new Error(`Relationship '${relationshipName}' of table '${tableName}' is defined to be both one-to-many and many-to-one. Only one type is possible.`)
        }

        if (! relationship.oneToMany && ! relationship.manyToOne) {
          throw new Error(`Relationship '${relationshipName}' of table '${tableName}' is neither defined to be one-to-many nor many-to-one. You need to define to be one of the two.`)
        }

        if (table.columns[relationship.thisId] == undefined) {
          throw new Error(`The column '${relationship.thisId}' referenced in '${tableName}.${relationshipName}.thisId' does not exist. It needs to exist.`)
        }

        let otherTable = schema[relationship.otherTable]

        if (otherTable == undefined) {
          throw new Error(`The table '${schema[relationship.otherTable]}' referenced in '${tableName}.${relationshipName}.otherTable' does not exist. It needs to exist.`)
        }

        if (otherTable.columns[relationship.otherId] == undefined) {
          throw new Error(`The column '${relationship.otherId}' referenced in '${tableName}.${relationshipName}.otherId' does not exist in table '${schema[relationship.otherTable]}'. It needs to exist.`)
        }

        if (relationship.otherRelationship) {
          if (otherTable.relationships == undefined || otherTable.relationships[relationship.otherRelationship] == undefined) {
            throw new Error(`The relationship '${relationship.otherRelationship}' referenced in '${tableName}.${relationshipName}.otherRelationship' does not exist in table '${schema[relationship.otherTable]}'. It needs to exist.`)
          }

          let otherRelationship = otherTable.relationships[relationship.otherRelationship]

          if (otherRelationship.otherRelationship == undefined) {
            throw new Error(`The relationship '${relationship.otherTable}.${relationship.otherRelationship}' referenced in '${tableName}.${relationshipName}.otherRelationship' does not define the property 'otherRelationship'. Since the defined relation is a one-to-one it needs to define this property.`)
          }

          if (otherRelationship.otherRelationship != relationshipName) {
            throw new Error(`The relationship '${relationship.otherTable}.${relationship.otherRelationship}' referenced in '${tableName}.${relationshipName}.otherRelationship' does not reference the correct relationship '${relationshipName}'. Since the defined relation is a one-to-one it needs to define back to the correct relation.`)
          }
        }
      }
    }
  }
}
