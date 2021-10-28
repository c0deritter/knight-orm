import { Criteria, CriteriaObject } from 'knight-criteria'
import { getPropertyName, isIdColumn, Schema, Table } from './Schema'

export interface UpdateCriteria {
  [column: string]: any
  '@criteria': Criteria
}

export function instanceCriteriaToRowCriteria<T extends Criteria>(schema: Schema, tableName: string, instanceCriteria: T): T {
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

  for (let propertyName of Object.keys(instanceCriteria)) {
    if (propertyName[0] == '@') {
      rowCriteria[propertyName] = (instanceCriteria as any)[propertyName]
    }
  }

  return <T> rowCriteria
}

export function rowToUpdateCriteria(schema: Schema, tableName: string, row: any): UpdateCriteria {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let updateCriteria: UpdateCriteria = {
    '@criteria': {} as CriteriaObject
  }

  for (let column of Object.keys(table.columns)) {
    if (isIdColumn(table.columns[column])) {
      (updateCriteria['@criteria'] as CriteriaObject)[column] = row[column] === undefined ? null : row[column]
    }
    else if (column in row && row[column] !== undefined) {
      updateCriteria[column] = row[column]
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

export function rowToDeleteCriteria(schema: Schema, tableName: string, row: any): CriteriaObject {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let deleteCriteria: CriteriaObject = {}

  for (let column of Object.keys(table.columns)) {
    if (isIdColumn(table.columns[column]) && row[column] !== undefined) {
      deleteCriteria[column] = row[column]
    }
  }

  return deleteCriteria
}

export function instanceToDeleteCriteria(schema: Schema, tableName: string, instance: any): CriteriaObject {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let row = table.instanceToRow(instance)
  return rowToDeleteCriteria(schema, tableName, row)
}
