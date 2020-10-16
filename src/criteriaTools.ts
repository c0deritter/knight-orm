import { DeleteCriteria, UpdateCriteria } from 'mega-nice-criteria'
import { getPropertyName, isIdColumn, Schema } from './Schema'

export function instanceCriteriaToRowCriteria<T>(schema: Schema, tableName: string, instanceCriteria: T): T {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let rowCriteria: any = {}

  for (let column of Object.keys(table.columns)) {
    let propertyName = getPropertyName(table.columns[column])
    let propertyValue = (instanceCriteria as any)[propertyName]

    if (propertyValue === undefined) {
      continue
    }

    rowCriteria[column] = propertyValue
  }

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      let relationshipValue = (instanceCriteria as any)[relationshipName]
      let relationship = table.relationships[relationshipName]
  
      if (relationshipValue === undefined) {
        continue
      }
  
      let relationshipTable = relationship.otherTable
      rowCriteria[relationshipName] = instanceCriteriaToRowCriteria(schema, relationshipTable, relationshipValue)
    }
  }

  return <T> rowCriteria
}

export function rowToUpdateCriteria(schema: Schema, tableName: string, row: any): UpdateCriteria {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let updateCriteria: any = {
    set: {}
  }

  for (let column of Object.keys(table.columns)) {
    if (isIdColumn(table.columns[column])) {
      updateCriteria[column] = row[column] === undefined ? null : row[column]
    }
    else if (column in row && row[column] !== undefined) {
      updateCriteria.set[column] = row[column]
    }
  }

  return updateCriteria
}

export function instanceToUpdateCriteria(schema: Schema, tableName: string, instance: any): UpdateCriteria {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let row = table.instanceToRow(instance)
  return rowToUpdateCriteria(schema, tableName, row)
}

export function rowToDeleteCriteria(schema: Schema, tableName: string, row: any): DeleteCriteria {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let deleteCriteria: any = {}

  for (let column of Object.keys(table.columns)) {
    if (isIdColumn(table.columns[column]) && row[column] !== undefined) {
      deleteCriteria[column] = row[column]
    }
  }

  return deleteCriteria
}

export function instanceToDeleteCriteria(schema: Schema, tableName: string, instance: any): DeleteCriteria {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let row = table.instanceToRow(instance)
  return rowToDeleteCriteria(schema, tableName, row)
}