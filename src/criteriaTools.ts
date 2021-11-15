import { Criteria, CriteriaObject } from 'knight-criteria'
import { getPropertyName, isIdColumn, Schema } from './Schema'

export interface UpdateCriteria {
  [column: string]: any
  '@criteria': Criteria
}

export interface CriteriaIssue {
  location: string
  message: string
}

export function validateCriteria(schema: Schema, tableName: string, criteria: Criteria, path: string = ''): CriteriaIssue[] {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  if (table.columns == undefined) {
    throw new Error('Table does not defined any columns: ' + tableName)
  }

  let issues: CriteriaIssue[] = []

  if (criteria == undefined) {
    return issues
  }

  if (criteria instanceof Array) {
    for (let criterium of criteria) {
      if (typeof criterium == 'object') {
        let criteriumIssues = validateCriteria(schema, tableName, criterium)
        issues.push(...criteriumIssues)
      }
    }
  }

  else if (typeof criteria == 'object' && criteria !== null) {
    let columnNames = Object.keys(table.columns)
    
    let relationshipNames: string[]
    if (table.relationships != undefined) {
      relationshipNames = Object.keys(table.relationships)
    }
    else {
      relationshipNames = []
    }

    for (let key of Object.keys(criteria)) {
      if (columnNames.indexOf(key) > -1) {
        continue
      }

      if (relationshipNames.indexOf(key) > -1) {
        continue
      }

      if (key == '@not' || key == '@load' || key == '@loadSeparately' || key == '@count' ||
          key == '@min' || key == '@max' || key == '@orderBy' || key == '@limit' || key == '@offset') {
        continue
      }

      issues.push({
        location: path + key,
        message: 'Given column, relationship or @-property does not exist'
      })
    }

    for (let relationshipName of relationshipNames) {
      if (criteria[relationshipName] != undefined) {
        let relationship = table.relationships![relationshipName]
        let relationshipIssues = validateCriteria(schema, relationship.otherTable, criteria[relationshipName], path + relationshipName + '.')
        issues.push(...relationshipIssues)
      }
    }
  }

  return issues
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

export function rowToDeleteCriteria(schema: Schema, tableName: string, row: any): Criteria {
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

export function instanceToDeleteCriteria(schema: Schema, tableName: string, instance: any): Criteria {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let row = table.instanceToRow(instance)
  return rowToDeleteCriteria(schema, tableName, row)
}
