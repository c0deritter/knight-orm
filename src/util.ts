import { DeleteCriteria, UpdateCriteria } from 'mega-nice-criteria'
import { Relationship, Schema, Table } from './Schema'

export function isId(columnSchema: string | { property: string, id: boolean }): boolean {
  if (typeof columnSchema == 'string') {
    return false
  }

  return columnSchema.id
}

export function getPropertyName(columnSchema: string | { property: string, id: boolean }): string {
  if (typeof columnSchema == 'string') {
    return columnSchema
  }

  return columnSchema.property
}

export function relationshipsOnly(table: Table): {[ relationship: string ]: Relationship } {
  let relationships: {[ relationship: string ]: any|Relationship } = {}

  for (let property of Object.keys(table)) {
    if (property == 'name' || property == 'columns' || typeof table[property] == 'function') {
      continue
    }

    relationships[property] = table[property]
  }

  return relationships
}

export function instanceCriteriaToRowCriteria<T>(instanceCriteria: any, tableName: string, schema: Schema): T {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let rowCriteria: any = {}

  for (let column of Object.keys(table.columns)) {
    let propertyName = getPropertyName(table.columns[column])
    let propertyValue = instanceCriteria[propertyName]

    if (propertyValue === undefined) {
      continue
    }

    rowCriteria[column] = propertyValue
  }

  for (let relationshipName of Object.keys(relationshipsOnly(table))) {
    let relationshipValue = instanceCriteria[relationshipName]
    let relationship = table[relationshipName] as Relationship

    if (relationshipValue === undefined) {
      continue
    }

    let relationshipTable = relationship.otherTable
    rowCriteria[relationshipName] = instanceCriteriaToRowCriteria(relationshipValue, relationshipTable, schema)
  }

  return <T> rowCriteria
}

export function instanceToUpdateCriteria(instance: any, table: Table): UpdateCriteria {
  let row = table.instanceToRow(instance)
  let updateCriteria: any = {
    set: {}
  }

  for (let column of Object.keys(table.columns)) {
    if (isId(table.columns[column])) {
      updateCriteria[column] = row[column]
    }
    else if (column in row) {
      updateCriteria.set[column] = row[column]
    }
  }

  return updateCriteria
}

export function instanceToDeleteCriteria(instance: any, table: Table): DeleteCriteria {
  let row = table.instanceToRow(instance)
  let deleteCriteria: any = {}

  for (let column of Object.keys(table.columns)) {
    if (isId(table.columns[column])) {
      deleteCriteria[column] = row[column]
    }
  }

  return deleteCriteria
}