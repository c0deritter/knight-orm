import { Criteria, CriteriaObject, isCriteriaComparison, Operator, OrderBy } from 'knight-criteria'
import { Log } from 'knight-log'
import { comparison, Condition, Query } from 'knight-sql'
import { unjoinRows } from './join'
import { databaseIndependentQuery, selectAllColumnsExplicitly, SelectResult } from './query'
import { Relationship, Table } from './schema'

let log = new Log('knight-orm/criteria.ts')

export interface CriteriaIssue {
  location: string
  message: string
}

export function validateCriteria(table: Table, criteria: Criteria, path: string = ''): CriteriaIssue[] {
  let issues: CriteriaIssue[] = []

  if (criteria == undefined) {
    return issues
  }

  if (criteria instanceof Array) {
    for (let criterium of criteria) {
      if (typeof criterium == 'object') {
        let criteriumIssues = validateCriteria(table, criterium)
        issues.push(...criteriumIssues)
      }
    }
  }

  else if (typeof criteria == 'object' && criteria !== null) {
    for (let key of Object.keys(criteria)) {
      if (table.columnNames.indexOf(key) > -1) {
        continue
      }

      if (table.relationshipNames.indexOf(key) > -1) {
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

    for (let relationship of table.relationships) {
      if (criteria[relationship.name] != undefined) {
        let relationshipIssues = validateCriteria(relationship.otherTable, criteria[relationship.name], path + relationship.name + '.')
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
export function instanceCriteriaToRowCriteria(table: Table, instanceCriteria: Criteria): Criteria {
  let l = log.fn('instanceCriteriaToRowCriteria')
  l.param('table.name', table.name)
  l.param('instanceCriteria', instanceCriteria)
  
  if (instanceCriteria instanceof Array) {
    l.lib('Given instance criteria are of type array')
    let rowCriteria = []
    
    for (let instanceCriterium of instanceCriteria) {
      if (typeof instanceCriterium == 'object' && instanceCriterium !== null) {
        l.calling('Converting criteria object to refer database columns')
        let rowCriterium = instanceCriteriaToRowCriteria(table, instanceCriterium)
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

    for (let column of table.columns) {
      l.dev('Trying to add property as column', column.propertyName, column.name)

      if (column.propertyName in instanceCriteria) {
        l.dev('Property contained. Adding.', instanceCriteria[column.propertyName])
        rowCriteria[column.name] = instanceCriteria[column.propertyName]
      }
      else {
        l.dev('Property not contained. Not adding.')
      }
    }

    l.lib('Converted instance properties to database columns and set them on the result', rowCriteria)
  
    if (table.relationships.length > 0) {
      l.lib('Convert relationships...')
      l.location = []

      for (let relationship of table.relationships) {
        l.location[0] = relationship.name
        l.lib('Converting next relationship', relationship.name)

        if (typeof instanceCriteria[relationship.name] == 'object' && instanceCriteria[relationship.name] !== null) {
          l.calling('Converting relationship criteria to refer database columns')
          let relationshipRowCriteria = instanceCriteriaToRowCriteria(relationship.otherTable, instanceCriteria[relationship.name])
          l.calling('Converted relationship criteria to refer database columns')
          rowCriteria[relationship.name] = relationshipRowCriteria
        }
        else {
          l.lib('Invalid relationship criteria found. Not adding.', instanceCriteria[relationship.name])
        }
      }

      l.location = undefined
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
          let column = table.getColumnByPropertyName(orderBy)

          if (column != undefined) {
            rowCriteria['@orderBy'] = column.name
          }
        }

        else if (orderBy instanceof Array) {
          rowCriteria['@orderBy'] = []

          for (let orderByElement of orderBy) {
            if (typeof orderByElement == 'string') {
              let column = table.getColumnByPropertyName(orderByElement)
    
              if (column != undefined) {
                rowCriteria['@orderBy'].push(column.name)
              }
            }

            else if (typeof orderByElement == 'object' && orderByElement !== null && 'field' in orderByElement) {
              let column = table.getColumnByPropertyName(orderByElement.field)

              if (column != undefined) {
                let orderByObject: OrderBy = {
                  field: column.name
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
          let column = table.getColumnByPropertyName(orderBy.field)

          if (column != undefined) {
            let orderByObject: OrderBy = {
              field: column.name
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

export function addCriteria(table: Table, query: Query, criteria: Criteria | undefined, alias?: string, condition?: Condition) {
  let l = log.fn('addCriteria')
  l.param('table.name', table.name)
  l.param('query', query)
  l.param('criteria', criteria)
  l.param('alias', alias)
  l.param('condition', condition)

  if (criteria == undefined) {
    l.returning('Criteria are undefined or null. Returning...')
    return
  }

  if (condition == undefined) {
    if (query._where == undefined) {
      query._where = new Condition
      query._where.removeOuterLogicalOperators = true
    }

    condition = query._where
  }
  else {
    condition.removeOuterLogicalOperators = true
  }

  let aliasPrefix = alias != undefined && alias.length > 0 ? alias + '.' : ''

  if (criteria instanceof Array) {
    l.lib('Given criteria is an array')

    let logical = 'OR'

    for (let arrayValue of criteria) {
      if (typeof arrayValue == 'string') {
        let upperCase = arrayValue.toUpperCase()

        if (upperCase == 'AND' || upperCase == 'OR' || upperCase == 'XOR') {
          logical = upperCase
          l.lib('Setting logical operator to', logical)
          continue
        }
      }

      l.lib('Adding logical operator', logical)
      condition.push(logical)

      let subCondition = new Condition
      subCondition.surroundWithBrackets = true
      condition.push(subCondition)

      l.calling('Add sub criteria through recursion', arrayValue)
      addCriteria(table, query, arrayValue as any, alias, subCondition)
      l.called('Added sub criteria through recursion')
    }
  }
  else if (typeof criteria == 'object' && criteria !== null) {
    l.lib('Given criteria is an object')

    if (criteria['@orderBy'] != undefined) {
      if (typeof criteria['@orderBy'] == 'string') {
        if (table.hasColumn(criteria['@orderBy'])) {
          l.lib('Adding order by', criteria['@orderBy'])
          query.orderBy(aliasPrefix + criteria['@orderBy'])
        }
        else {
          l.lib('Not adding order by because the given column is not contained in the table', criteria['@orderBy'])
        }
      }
      else if (criteria['@orderBy'] instanceof Array) {
        l.lib('Found an array of order by conditions', criteria['@orderBy'])

        for (let orderBy of criteria['@orderBy']) {
          if (typeof orderBy == 'string') {
            if (table.hasColumn(orderBy)) {
              l.lib('Adding order by', orderBy)
              query.orderBy(aliasPrefix + orderBy)
            }
            else {
              l.lib('Not adding order by because the given column is not contained in the table', orderBy)
            }    
          }
          else if (typeof orderBy == 'object') {
            if (typeof orderBy.field == 'string') {
              if (! table.hasColumn(orderBy.field)) {
                l.lib('Not adding order by because the given column is not contained in the table', orderBy)
                continue
              }
  
              let direction: string|undefined = undefined
  
              if (typeof orderBy.direction == 'string') {
                let upperCase = orderBy.direction.toUpperCase()
  
                if (upperCase == 'ASC' || upperCase == 'DESC') {
                  direction = upperCase
                }
              }
  
              if (direction == undefined) {
                l.lib('Adding order by', orderBy)
                query.orderBy(aliasPrefix + orderBy.field)
              }
              else {
                l.lib('Adding order by', orderBy)
                query.orderBy(aliasPrefix + orderBy.field + ' ' + direction)
              }  
            }
            else {
              l.lib('Not adding order by because the given field property is not of type object', orderBy)
            }
          }
          else {
            l.lib('Not adding order by because the given element was not neither a string nor an object', orderBy)
          }
        }
      }
      else if (typeof criteria['@orderBy'] == 'object') {
        if (typeof criteria['@orderBy'].field == 'string') {
          if (table.hasColumn(criteria['@orderBy'].field)) {
            let direction: string|undefined = undefined

            if (typeof criteria['@orderBy'].direction == 'string') {
              let upperCase = criteria['@orderBy'].direction.toUpperCase()
  
              if (upperCase == 'ASC' || upperCase == 'DESC') {
                direction = upperCase
              }
            }
  
            if (direction == undefined) {
              l.lib('Adding order by', criteria['@orderBy'])
              query.orderBy(aliasPrefix + criteria['@orderBy'].field)
            }
            else {
              l.lib('Adding order by', criteria['@orderBy'])
              query.orderBy(aliasPrefix + criteria['@orderBy'].field + ' ' + direction)
            }
          }
          else {
            l.lib('Not adding order by because the given column is not contained in the table', criteria['@orderBy'])
          }
        }
        else {
          l.lib('Not adding order by because the given field property is not a string', criteria['@orderBy'])
        }
      }
      else {
        l.lib('Not adding order by because it was neither a string, an array nor an object', criteria['@orderBy'])
      }
    }

    if (query._limit == undefined && typeof criteria['@limit'] == 'number' && ! isNaN(criteria['@limit'])) {
      l.lib('Setting limit', criteria['@limit'])
      query._limit = criteria['@limit']
    }

    if (query._offset == undefined && typeof criteria['@offset'] == 'number' && ! isNaN(criteria['@offset'])) {
      l.lib('Setting offset', criteria['@offset'])
      query._offset = criteria['@offset']
    }

    if (criteria['@not'] === true) {
      condition.push('NOT')
      
      let negatedCondition = new Condition
      negatedCondition.removeOuterLogicalOperators = true
      negatedCondition.surroundWithBrackets = true

      condition.push(negatedCondition)
      condition = negatedCondition
    }

    l.lib('Iterating over all columns')

    for (let column of table.columns) {
      l.location = [column.name]

      if (criteria[column.name] === undefined) {
        l.lib('Skipping column because it is not contained in the given criteria')
        continue
      }

      let value: any = criteria[column.name]
      l.lib('Processing column using criterium', value)

      l.lib('Adding logical operator AND')
      condition.push('AND')

      if (isCriteriaComparison(value)) {
        l.lib('Given object represents a comparison')

        let operator = value['@operator'].toUpperCase()

        if (!(operator in Operator)) {
          l.lib(`Operator '${operator}' is not supported. Continuing...`)
          continue
        }

        if (value['@value'] !== undefined) {
          let comp = comparison(aliasPrefix + column.name, operator, value['@value'])
          
          if (value['@not'] === true) {
            l.lib('Adding comparison with NOT', comp)
            condition.push('NOT', comp)
          }
          else {
            l.lib('Adding comparison', comp)
            condition.push(comp)
          }
        }
        else {
          l.lib('Not adding comparison because the value is undefined')
        }
      }

      else if (value instanceof Array) {
        l.lib('The given criterium is an array')

        let atLeastOneComparison = false

        for (let arrayValue of value) {
          if (isCriteriaComparison(arrayValue)) {
            atLeastOneComparison = true
            break
          }
        }

        if (!atLeastOneComparison) {
          let comp = comparison(aliasPrefix + column.name, value)
          l.lib('Adding comparison', comp)
          condition.push(comp)
        }
        else {
          l.lib('Array represents connected comparisons')

          let logical = 'OR'
          
          let subCondition = new Condition
          subCondition.removeOuterLogicalOperators = true
          subCondition.surroundWithBrackets = true
          condition.push(subCondition)

          for (let arrayValue of value) {
            if (typeof arrayValue == 'string') {
              let upperCase = arrayValue.toUpperCase()

              if (upperCase == 'AND' || upperCase == 'OR' || upperCase == 'XOR') {
                logical = upperCase
                l.lib('Setting logical operator to', logical)
                continue
              }
            }

            if (isCriteriaComparison(arrayValue)) {
              if (arrayValue['@value'] === undefined) {
                l.lib('Skipping comparison because its value is undefined', arrayValue)
                continue
              }

              l.lib('Processing comparison', arrayValue)

              let operator = arrayValue['@operator'].toUpperCase()

              if (!(operator in Operator)) {
                l.lib(`Comparison operator '${operator}' is not supported. Continuing...`)
                continue
              }

              l.lib('Adding logical operator', logical)
              subCondition.push(logical)

              let comp = comparison(aliasPrefix + column.name, operator, arrayValue['@value'])
              
              if (arrayValue['@not'] === true) {
                l.lib('Adding comparison with NOT', comp)
                subCondition.push('NOT', comp)
              }
              else {
                l.lib('Adding comparison', comp)
                subCondition.push(comp)
              }
            }

            l.lib('Setting logical operator back to the default OR')
            logical = 'OR'
          }

          l.lib('Created brackets', subCondition)
        }
      }
      else {
        let comp = comparison(aliasPrefix + column.name, value)
        l.lib('Adding comparison with default operator =', comp)
        condition.push(comp)
      }
    }

    l.location = undefined

    if (table.relationships.length > 0) {
      l.lib('Iterating over all relationships...')

      for (let relationship of table.relationships) {
        l.location = [ relationship.name ]

        if (! (relationship.name in criteria)) {
          l.lib('Skipping relationship because it is not contained in the given criteria')
          continue
        }

        let relationshipCriteria = criteria[relationship.name]
        let otherTable = relationship.otherTable

        l.lib('Processing given criterium', relationshipCriteria)

        if (relationshipCriteria['@loadSeparately'] !== true) {
          let thisId = relationship.thisId
          let otherId = relationship.otherId

          let joinAlias = alias != undefined && alias.length > 0 ? alias + '__' + relationship.name : relationship.name
          l.dev('joinAlias', joinAlias)

          query.join('LEFT', otherTable.name, joinAlias, (alias != undefined && alias.length > 0 ? alias + '.' : '') + thisId.name + ' = ' + joinAlias + '.' + otherId.name)
          l.lib('Added LEFT JOIN to query', query._join!.pieces![query._join!.pieces!.length - 1])

          l.calling('Filling query with the relationship criteria', relationshipCriteria)
          addCriteria(otherTable, query, relationshipCriteria, joinAlias, condition)
          l.called('Filled query with the relationship criteria', relationshipCriteria)
        }
        else {
          l.lib('Not adding because it is to load in a separate query')
        }
      }
    }
  }
  else {
    l.warn('Given criteria type is not supported. It needs to be either an object or an array.', typeof criteria)
  }
}

export interface RelationshipToLoad {
  relationship: Relationship
  relationshipCriteria: CriteriaObject
  rows: any[]
}

export interface RelationshipsToLoad {
  [ relationshipPath: string ]: RelationshipToLoad
}

export function determineRelationshipsToLoad(
  table: Table, 
  rows: any[], 
  criteria: Criteria, 
  relationshipPath: string = '', 
  relationshipsToLoad: RelationshipsToLoad = {}
): RelationshipsToLoad {

  let l = log.fn('determineRelationshipsToLoad')
  
  if (relationshipPath.length > 0) {
    l.location = [ relationshipPath ]
  }
  else {
    l.location = [ '.' ]
  }

  l.param('table.name', table.name)
  l.param('rows', rows)
  l.param('criteria', criteria)
  l.param('relationshipPath', relationshipPath)
  l.param('relationshipsToLoad', relationshipsToLoad)

  if (table.relationships == undefined) {
    l.returning('There are not any relationships. Returning...')
    return {}
  }

  if (criteria instanceof Array) {
    l.lib('Criteria is an array')

    for (let criterium of criteria) {
      if (criterium instanceof Array || typeof criterium == 'object') {
        l.lib('Determining relationships to load of', criterium)
        determineRelationshipsToLoad(table, rows, criterium, relationshipPath, relationshipsToLoad)
        l.lib('Determined relationships to load of', criterium)
      }
    }
  }
  else if (typeof criteria == 'object') {
    l.lib('Criteria is an object')
    l.lib('Iterating through all possible relationships', Object.keys(table.relationships))
    
    l.location.push('->')

    for (let relationship of table.relationships) {
      l.location[2] = relationship.name
  
      let relationshipCriteria = criteria[relationship.name]
      if (relationshipCriteria == undefined) {
        l.lib('There are no criteria. Processing next relationship...')
        continue
      }
  
      l.lib('Found criteria', relationshipCriteria)
  
      let subRelationshipPath = relationshipPath + '.' + relationship.name
      l.lib('Creating relationship path', subRelationshipPath)
  
      if (relationshipCriteria['@loadSeparately'] === true) {
        l.lib('Relationship should be loaded separately')
  
        if (relationshipsToLoad[subRelationshipPath] == undefined) {
          relationshipsToLoad[subRelationshipPath] = {
            relationship: relationship,
            relationshipCriteria: relationshipCriteria,
            rows: rows
          }
        }
      }
      else if (relationshipCriteria['@load'] === true) {  
        let relationshipRows = []
        
        for (let row of rows) {
          if (relationship.manyToOne && row[relationship.name] != undefined || 
              relationship.oneToMany && row[relationship.name] instanceof Array && row[relationship.name].length > 0) {
            
            if (relationship.manyToOne) {
              relationshipRows.push(row[relationship.name])
            }
            else {
              relationshipRows.push(...row[relationship.name])
            }
          }
        }
  
        l.lib('Relationship was already loaded through a JOIN. Determining relationships of the relationship. Going into recursion...')
  
        determineRelationshipsToLoad(
          relationship.otherTable, 
          relationshipRows, 
          relationshipCriteria, 
          subRelationshipPath,
          relationshipsToLoad
        )
  
        l.lib('Returning from recursion...')
      }
      else {
        l.lib('Relationship should not be loaded')
      }
    }  
  }
  else {
    l.lib('Criteria has an invalid type. Needs to be either an array or an object.', typeof criteria)
  }

  if (relationshipPath.length > 0) {
    l.location = [ relationshipPath ]
  }
  else {
    l.location = undefined
  }

  l.returning('Returning relationships to load...', relationshipsToLoad)
  return relationshipsToLoad
}

export function buildSelectQuery(table: Table, criteria: Criteria): Query {
  let query = new Query
  query.from(table.name, table.name)

  addCriteria(table, query, criteria, table.name)
  selectAllColumnsExplicitly(table.schema, query)

  return query
}

export function buildCountQuery(table: Table, criteria: Criteria): Query {
  let query = new Query
  query.from(table.name, table.name).select('COUNT(*)')

  addCriteria(table, query, criteria, table.name)

  return query
}

export async function select(table: Table, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: Criteria): Promise<any[]> {
  let l = log.fn('select')
  l.location = [ table.name ]
  l.param('criteria', criteria)

  let query = buildSelectQuery(table, criteria)
  l.dev('Built SELECT query', query)

  l.lib('Querying database with given SQL string and values...')
  let joinedRows

  try {
    joinedRows = await databaseIndependentQuery(db, queryFn, query.sql(db), query.values()) as SelectResult
  }
  catch (e) {
    throw new Error(e as any)
  }

  l.dev('Received rows', joinedRows)

  l.calling('Unjoining rows for criteria...')
  let rows = unjoinRows(table, joinedRows, criteria, table.name + '__')
  l.called('Unjoined rows for criteria...', criteria)
  l.dev('Unjoined rows', rows)

  l.calling('Determine relationships to load...')
  let relationshipsToLoad = determineRelationshipsToLoad(table, rows, criteria)
  l.called('Determined relationships to load for criteria...', criteria)

  l.lib('Loading all relationships that need to be loaded in a seperate query...', Object.keys(relationshipsToLoad))

  for (let relationshipPath of Object.keys(relationshipsToLoad)) {
    l.lib('Loading relationships for path', relationshipPath)

    let relationshipToLoad = relationshipsToLoad[relationshipPath]
    
    let relationship = relationshipToLoad.relationship
    l.lib('Relationship table', relationship.table.name)
    l.lib('Relationship name', relationship.name)

    let idsToLoad: any[] = []
    for (let row of relationshipToLoad.rows) {
      if (row[relationship.thisId.name] !== undefined) {
        if (idsToLoad.indexOf(row[relationship.thisId.name]) == -1) {
          idsToLoad.push(row[relationship.thisId.name])
        }
      }
    }

    let criteria = {
      ...relationshipToLoad.relationshipCriteria
    }

    criteria[relationship.otherId.name] = idsToLoad

    l.calling('Loading relationship rows with the following criteria', criteria)
    let loadedRelationships = await select(relationship.otherTable, db, queryFn, criteria)
    l.called('Loaded relationship rows for criteria', criteria)
    l.dev('Loaded relationship rows', loadedRelationships)

    l.lib('Attaching relationship rows...')

    for (let row of relationshipToLoad.rows) {
      l.dev('Attaching relationship row', row)

      if (relationship.oneToMany === true) {
        row[relationship.name] = []
      }
      else {
        row[relationship.name] = null
      }

      for (let loadedRelationship of loadedRelationships) {
        if (row[relationship.thisId.name] == loadedRelationship[relationship.otherId.name]) {
          if (relationship.oneToMany === true) {
            l.dev('Pushing into array of one-to-many...', loadedRelationship)
            row[relationship.name].push(loadedRelationship)
          }
          else {
            l.dev('Setting property of many-to-one..', loadedRelationship)
            row[relationship.name] = loadedRelationship
          }
        }
      }
    }
  }

  l.returning('Returning rows...', rows)
  return rows
}

export interface UpdateCriteria {
  [column: string]: any
  '@criteria': Criteria
}

export async function update(table: Table, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: UpdateCriteria): Promise<any[]> {
  let l = log.fn('update')
  l.param('table.name', table.name)
  l.param('criteria', criteria)

  let query = new Query
  query.update(table.name)

  for (let column of table.columns) {
    if (criteria[column.name] !== undefined) {
      let value = criteria[column.name]
      query.set(column.name, value)
    }
  }

  addCriteria(table, query, criteria['@criteria'])

  if (db == 'postgres') {
    query.returning('*')
  }

  let sqlString = query.sql(db)
  let values = query.values()

  l.lib('SQL string', sqlString)
  l.lib('Values', values)

  let updatedRows = await queryFn(sqlString, values)
  
  l.returning('Returning updated rows...', updatedRows)
  return updatedRows
}

export async function delete_(table: Table, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any>, criteria: Criteria): Promise<any[]> {
  let l = log.fn('delete_')
  l.param('table.name', table.name)
  l.param('criteria', criteria)

  let query = new Query
  query.deleteFrom(table.name)
  addCriteria(table, query, criteria)

  if (db == 'postgres') {
    query.returning('*')
  }

  let sqlString = query.sql(db)
  let values = query.values()

  l.lib('SQL string', sqlString)
  l.lib('Values', values)

  let deletedRows = await queryFn(sqlString, values)
  
  l.returning('Returning deleted rows...', deletedRows.rows)
  return deletedRows.rows
}

// export function rowToUpdateCriteria(schema: Schema, tableName: string, row: any): UpdateCriteria {
//   let table = schema[tableName]

//   if (table == undefined) {
//     throw new Error('Table not contained in schema: ' + tableName)
//   }

//   let updateCriteria: UpdateCriteria = {
//     '@criteria': {} as CriteriaObject
//   }

//   for (let column of Object.keys(table.columns)) {
//     if (isPrimaryKeyColumn(table, column)) {
//       (updateCriteria['@criteria'] as CriteriaObject)[column] = row[column] === undefined ? null : row[column]
//     }
//     else if (column in row && row[column] !== undefined) {
//       updateCriteria[column] = row[column]
//     }
//   }

//   return updateCriteria
// }

// export function instanceToUpdateCriteria(schema: Schema, tableName: string, instance: any): UpdateCriteria {
//   let table = schema[tableName]

//   if (table == undefined) {
//     throw new Error('Table not contained in schema: ' + tableName)
//   }

//   let row = {}// table.instanceToRow(instance) TODO: !!!
//   return rowToUpdateCriteria(schema, tableName, row)
// }

// export function rowToDeleteCriteria(schema: Schema, tableName: string, row: any): Criteria {
//   let table = schema[tableName]

//   if (table == undefined) {
//     throw new Error('Table not contained in schema: ' + tableName)
//   }

//   let deleteCriteria: CriteriaObject = {}

//   for (let column of Object.keys(table.columns)) {
//     if (isPrimaryKeyColumn(table, column) && row[column] !== undefined) {
//       deleteCriteria[column] = row[column]
//     }
//   }

//   return deleteCriteria
// }

// export function instanceToDeleteCriteria(schema: Schema, tableName: string, instance: any): Criteria {
//   let table = schema[tableName]

//   if (table == undefined) {
//     throw new Error('Table not contained in schema: ' + tableName)
//   }

//   let row = {} //table.instanceToRow(instance) TODO: !!!
//   return rowToDeleteCriteria(schema, tableName, row)
// }
