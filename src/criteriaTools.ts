import { Criteria, CriteriaObject, OrderBy } from 'knight-criteria'
import { Log } from 'knight-log'
import { getColumnName, getPropertyName, isPrimaryKeyColumn, Schema } from './Schema'

let log = new Log('knight-orm/criteriaTools.ts')

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
    throw new Error('Table does not define any columns: ' + tableName)
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

/**
 * Converts criteria which use properties from the object world into criteria which use columns
 * from the database world.
 * 
 * @param schema The schema which maps database columns to object properties
 * @param tableName The name of the table the given instance criteria refer to
 * @param instanceCriteria The criteria referring properties from the object world
 * @returns Criteria referring columns of the database world
 */
export function instanceCriteriaToRowCriteria(schema: Schema, tableName: string, instanceCriteria: Criteria): Criteria {
  let l = log.fn('instanceCriteriaToRowCriteria')
  l.param('tableName', tableName)
  l.param('instanceCriteria', instanceCriteria)
  
  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  if (instanceCriteria instanceof Array) {
    l.lib('Given instance criteria are of type array')
    let rowCriteria = []
    
    for (let instanceCriterium of instanceCriteria) {
      if (typeof instanceCriterium == 'object' && instanceCriterium !== null) {
        l.calling('Converting criteria object to refer database columns')
        let rowCriterium = instanceCriteriaToRowCriteria(schema, tableName, instanceCriterium)
        l.called('Converted criteria object to refer database columns')
        l.lib('Adding converted criteria')
        rowCriteria.push(rowCriterium)
      }
      else if (instanceCriterium == 'AND' || instanceCriterium == 'OR' || instanceCriterium == 'XOR') {
        l.lib('Adding logical operator', instanceCriterium)
        rowCriteria.push(instanceCriterium)
      }
      else {
        l.lib('Found invalid element in criteria array. Not adding.', instanceCriterium)
      }
    }

    return rowCriteria
  }

  else if (typeof instanceCriteria == 'object' && instanceCriteria !== null) {
    l.lib('Given instance criteria are of type object')
    let rowCriteria: CriteriaObject = {}

    for (let columnName of Object.keys(table.columns)) {
      let propertyName = getPropertyName(table, columnName)
      l.dev('Trying to add property as column', propertyName, columnName)

      if (propertyName != undefined && propertyName in instanceCriteria) {
        l.dev('Property contained. Adding.', instanceCriteria[propertyName])
        rowCriteria[columnName] = instanceCriteria[propertyName]
      }
      else {
        l.dev('Property not contained. Not adding.')
      }
    }

    l.lib('Converted instance properties to database columns and set them on the result', rowCriteria)
  
    if (table.relationships != undefined) {
      let relationshipNames = Object.keys(table.relationships)

      if (relationshipNames.length > 0) {
        l.lib('Convert relationships', relationshipNames)
        l.location = []

        for (let relationshipName of relationshipNames) {
          l.location[0] = relationshipName
          l.lib('Converting next relationship', relationshipName)

          if (typeof instanceCriteria[relationshipName] == 'object' && instanceCriteria[relationshipName] !== null) {
            let relationship = table.relationships[relationshipName]
            l.calling('Converting relationship criteria to refer database columns')
            let relationshipRowCriteria = instanceCriteriaToRowCriteria(schema, relationship.otherTable, instanceCriteria[relationshipName])
            l.calling('Converted relationship criteria to refer database columns')
            rowCriteria[relationshipName] = relationshipRowCriteria
          }
          else {
            l.lib('Invalid relationship criteria found. Not adding.', instanceCriteria[relationshipName])
          }
        }

        l.location = undefined
      }
    }
  
    for (let propertyName of Object.keys(instanceCriteria)) {
      if (propertyName == '@not' || propertyName == '@load' || propertyName == '@loadSeparately' || 
          propertyName == '@count' || propertyName == '@min' || propertyName == '@max' ||
          propertyName == '@limit' || propertyName == '@offset') {

        l.lib('Adding @-property', propertyName)
        ;(rowCriteria as any)[propertyName] = instanceCriteria[propertyName]
      }
      else if (propertyName == '@orderBy') {
        let orderBy = instanceCriteria['@orderBy']

        if (typeof orderBy == 'string') {
          let columnName = getColumnName(table, orderBy)

          if (columnName != undefined) {
            rowCriteria['@orderBy'] = columnName
          }
        }

        else if (orderBy instanceof Array) {
          rowCriteria['@orderBy'] = []

          for (let orderByElement of orderBy) {
            if (typeof orderByElement == 'string') {
              let columnName = getColumnName(table, orderByElement)
    
              if (columnName != undefined) {
                rowCriteria['@orderBy'].push(columnName)
              }
            }

            else if (typeof orderByElement == 'object' && orderByElement !== null && 'field' in orderByElement) {
              let columnName = getColumnName(table, orderByElement.field)

              if (columnName != undefined) {
                let orderByObject: OrderBy = {
                  field: columnName
                }

                rowCriteria['@orderBy'].push(orderByObject)

                if ('direction' in orderByElement) {
                  orderByObject.direction = orderByElement.direction
                }
              }
            }
          }
        }

        else if (typeof orderBy == 'object' && orderBy !== null && 'field' in orderBy) {
          let columnName = getColumnName(table, orderBy.field)

          if (columnName != undefined) {
            let orderByObject: OrderBy = {
              field: columnName
            }

            rowCriteria['@orderBy'] = orderByObject

            if ('direction' in orderBy) {
              orderByObject.direction = orderBy.direction
            }
          }
        }
      }
    }
  
    l.returning('Returning converted criteria', rowCriteria)
    return rowCriteria
  }

  l.returning('Returning unconverted criteria because they were neither an array nor an object and this invalid', instanceCriteria)
  return instanceCriteria
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
    if (isPrimaryKeyColumn(table, column)) {
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

  let row = {}// table.instanceToRow(instance) TODO: !!!
  return rowToUpdateCriteria(schema, tableName, row)
}

export function rowToDeleteCriteria(schema: Schema, tableName: string, row: any): Criteria {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let deleteCriteria: CriteriaObject = {}

  for (let column of Object.keys(table.columns)) {
    if (isPrimaryKeyColumn(table, column) && row[column] !== undefined) {
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

  let row = {} //table.instanceToRow(instance) TODO: !!!
  return rowToDeleteCriteria(schema, tableName, row)
}
