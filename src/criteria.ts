import { Criteria, CriteriaObject, isCriteriaComparison, Operator, OrderBy } from 'knight-criteria'
import { Log } from 'knight-log'
import { comparison, Condition, Query } from 'knight-sql'
import { databaseIndependentQuery, selectAllColumnsExplicitly, SelectResult } from './query'
import { unjoinRows } from './row'
import { getColumnName, getPropertyName, Schema } from './Schema'

let log = new Log('knight-orm/criteria.ts')

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

export function addCriteria(schema: Schema, tableName: string, query: Query, criteria: Criteria | undefined, alias?: string, condition?: Condition) {
  let l = log.fn('addCriteria')
  l.param('tableName', tableName)
  l.param('query', query)
  l.param('criteria', criteria)
  l.param('alias', alias)
  l.param('condition', condition)

  if (criteria == undefined) {
    l.returning('Criteria are undefined or null. Returning...')
    return
  }

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
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
      addCriteria(schema, tableName, query, arrayValue as any, alias, subCondition)
      l.called('Added sub criteria through recursion')
    }
  }
  else if (typeof criteria == 'object' && criteria !== null) {
    l.lib('Given criteria is an object')

    if (criteria['@orderBy'] != undefined) {
      if (typeof criteria['@orderBy'] == 'string') {
        if (table.columns[criteria['@orderBy']] != undefined) {
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
            if (table.columns[orderBy] != undefined) {
              l.lib('Adding order by', orderBy)
              query.orderBy(aliasPrefix + orderBy)
            }
            else {
              l.lib('Not adding order by because the given column is not contained in the table', orderBy)
            }    
          }
          else if (typeof orderBy == 'object') {
            if (typeof orderBy.field == 'string') {
              if (table.columns[orderBy.field] == undefined) {
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
          if (table.columns[criteria['@orderBy'].field] != undefined) {
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

    let columns = Object.keys(table.columns)

    l.lib('Iterating over all columns', columns)

    for (let column of columns) {
      l.location = [column]

      if (criteria[column] === undefined) {
        l.lib('Skipping column because it is not contained in the given criteria')
        continue
      }

      let value: any = criteria[column]
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
          let comp = comparison(aliasPrefix + column, operator, value['@value'])
          
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
          let comp = comparison(aliasPrefix + column, value)
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

              let comp = comparison(aliasPrefix + column, operator, arrayValue['@value'])
              
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
        let comp = comparison(aliasPrefix + column, value)
        l.lib('Adding comparison with default operator =', comp)
        condition.push(comp)
      }
    }

    l.location = undefined

    if (table.relationships != undefined) {
      let relationships = Object.keys(table.relationships)
      l.lib('Iterating over all relationships', relationships)

      for (let relationshipName of relationships) {
        l.location = [ relationshipName ]

        if (!(relationshipName in criteria)) {
          l.lib('Skipping relationship because it is not contained in the given criteria')
          continue
        }

        let relationship = table.relationships[relationshipName]
        let relationshipCriteria = criteria[relationshipName]
        let otherTable = schema[relationship.otherTable]

        if (otherTable == undefined) {
          throw new Error('Table not contained in schema: ' + relationship.otherTable)
        }

        l.lib('Processing given criterium', relationshipCriteria)

        if (relationshipCriteria['@loadSeparately'] !== true) {
          let thisId = relationship.thisId
          let otherTableName = relationship.otherTable
          let otherId = relationship.otherId

          if (typeof thisId != 'string' || thisId.length == 0) {
            throw new Error('Given relationship object does not contain property \'thisId\'')
          }

          if (typeof otherTableName != 'string' || otherTableName.length == 0) {
            throw new Error('Given relationship object do not contain property \'otherTable\'')
          }

          if (typeof otherId != 'string' || otherId.length == 0) {
            throw new Error('Given relationship object does not contain property \'otherId\'')
          }

          l.dev('thisId', thisId)
          l.dev('otherTableName', otherTableName)
          l.dev('otherId', otherId)

          let joinAlias = alias != undefined && alias.length > 0 ? alias + '__' + relationshipName : relationshipName
          l.dev('joinAlias', joinAlias)

          query.join('LEFT', otherTableName, joinAlias, (alias != undefined && alias.length > 0 ? alias + '.' : '') + thisId + ' = ' + joinAlias + '.' + otherId)
          l.lib('Adding LEFT JOIN to query', query._join!.pieces![query._join!.pieces!.length - 1])

          let otherTable = schema[otherTableName]

          if (otherTable == undefined) {
            throw new Error('Table not contained in schema: ' + otherTable)
          }

          l.calling('Filling query with the relationship criteria', relationshipCriteria)
          addCriteria(schema, otherTableName, query, relationshipCriteria, joinAlias, condition)
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
  tableName: string
  relationshipName: string
  relationshipCriteria: CriteriaObject
  rows: any[]
}

export interface RelationshipsToLoad {
  [ relationshipPath: string ]: RelationshipToLoad
}

export function determineRelationshipsToLoad(schema: Schema, tableName: string, rows: any[], criteria: Criteria, relationshipPath: string = '', relationshipsToLoad: RelationshipsToLoad = {}): RelationshipsToLoad {
  let l = log.fn('determineRelationshipsToLoad')
  
  if (relationshipPath.length > 0) {
    l.location = [ relationshipPath ]
  }
  else {
    l.location = [ '.' ]
  }

  l.param('tableName', tableName)
  l.param('rows', rows)
  l.param('criteria', criteria)
  l.param('relationshipPath', relationshipPath)
  l.param('relationshipsToLoad', relationshipsToLoad)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  if (table.relationships == undefined) {
    l.returning('There are not any relationships. Returning...')
    return {}
  }

  if (criteria instanceof Array) {
    l.lib('Criteria is an array')

    for (let criterium of criteria) {
      if (criterium instanceof Array || typeof criterium == 'object') {
        l.lib('Determining relationships to load of', criterium)
        determineRelationshipsToLoad(schema, tableName, rows, criterium, relationshipPath, relationshipsToLoad)
        l.lib('Determined relationships to load of', criterium)
      }
    }
  }
  else if (typeof criteria == 'object') {
    l.lib('Criteria is an object')
    l.lib('Iterating through all possible relationships', Object.keys(table.relationships))
    
    l.location.push('->')

    for (let relationshipName of Object.keys(table.relationships)) {
      l.location[2] = relationshipName
  
      let relationshipCriteria = criteria[relationshipName]
      if (relationshipCriteria == undefined) {
        l.lib('There are no criteria. Processing next relationship...')
        continue
      }
  
      l.lib('Found criteria', relationshipCriteria)
  
      let subRelationshipPath = relationshipPath + '.' + relationshipName
      l.lib('Creating relationship path', subRelationshipPath)
  
      if (relationshipCriteria['@loadSeparately'] === true) {
        l.lib('Relationship should be loaded separately')
  
        if (relationshipsToLoad[subRelationshipPath] == undefined) {
          relationshipsToLoad[subRelationshipPath] = {
            tableName: tableName,
            relationshipName: relationshipName,
            relationshipCriteria: relationshipCriteria,
            rows: rows
          }
        }
      }
      else if (relationshipCriteria['@load'] === true) {
        let relationship = table.relationships ? table.relationships[relationshipName] : undefined
        if (relationship == undefined) {
          throw new Error(`Relationship '${relationshipName}' not contained table '${tableName}'`)
        }
  
        let otherTable = schema[relationship.otherTable]
        if (otherTable == undefined) {
          throw new Error('Table not contained in schema: ' + relationship.otherTable)
        }
  
        let relationshipRows = []
        
        for (let row of rows) {
          if (relationship.manyToOne && row[relationshipName] != undefined || 
              relationship.oneToMany && row[relationshipName] instanceof Array && row[relationshipName].length > 0) {
            
            if (relationship.manyToOne) {
              relationshipRows.push(row[relationshipName])
            }
            else {
              relationshipRows.push(...row[relationshipName])
            }
          }
        }
  
        l.lib('Relationship was already loaded through a JOIN. Determining relationships of the relationship. Going into recursion...')
  
        determineRelationshipsToLoad(
          schema, 
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

export function buildSelectQuery(schema: Schema, tableName: string, criteria: Criteria): Query {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = new Query
  query.from(tableName, tableName)

  addCriteria(schema, tableName, query, criteria, tableName)
  selectAllColumnsExplicitly(schema, query)

  return query
}

export function buildCountQuery(schema: Schema, tableName: string, criteria: Criteria): Query {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = new Query
  query.from(tableName, tableName).select('COUNT(*)')
  addCriteria(schema, tableName, query, criteria, tableName)

  return query
}

export async function select(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: Criteria): Promise<any[]> {
  let l = log.fn('select')
  l.location = [ tableName ]
  l.param('criteria', criteria)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = buildSelectQuery(schema, tableName, criteria)
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
  let rows = unjoinRows(schema, tableName, joinedRows, criteria, tableName + '__')
  l.called('Unjoined rows for criteria...', criteria)
  l.dev('Unjoined rows', rows)

  l.calling('Determing relationships to load...')
  let relationshipsToLoad = determineRelationshipsToLoad(schema, tableName, rows, criteria)
  l.called('Determined relationships to load for criteria...', criteria)

  l.lib('Loading all relationships that need to be loaded in a seperate query...', Object.keys(relationshipsToLoad))

  for (let relationshipPath of Object.keys(relationshipsToLoad)) {
    l.lib('Loading relationships for path', relationshipPath)

    let relationshipToLoad = relationshipsToLoad[relationshipPath]
    
    let relationshipTable = schema[relationshipToLoad.tableName]
    l.lib('Relationship table', relationshipTable)
    l.lib('Relationship name', relationshipToLoad.relationshipName)

    if (relationshipTable == undefined) {
      throw new Error('Table not contained in schema: ' + relationshipToLoad.tableName)
    }

    let relationship = relationshipTable.relationships ? relationshipTable.relationships[relationshipToLoad.relationshipName] : undefined
    if (relationship == undefined) {
      throw new Error(`Relationship '${relationshipToLoad.relationshipName}' not contained table '${relationshipToLoad.tableName}'`)
    }

    let idsToLoad: any[] = []
    for (let row of relationshipToLoad.rows) {
      if (row[relationship.thisId] !== undefined) {
        if (idsToLoad.indexOf(row[relationship.thisId]) == -1) {
          idsToLoad.push(row[relationship.thisId])
        }
      }
    }

    let criteria = {
      ...relationshipToLoad.relationshipCriteria
    }

    criteria[relationship.otherId] = idsToLoad

    l.calling('Loading relationship rows with the following criteria', criteria)
    let loadedRelationships = await select(schema, relationship.otherTable, db, queryFn, criteria)
    l.called('Loaded relationship rows for criteria', criteria)
    l.dev('Loaded relationship rows', loadedRelationships)

    l.lib('Attaching relationship rows...')

    for (let row of relationshipToLoad.rows) {
      l.dev('Attaching relationship row', row)

      if (relationship.oneToMany === true) {
        row[relationshipToLoad.relationshipName] = []
      }
      else {
        row[relationshipToLoad.relationshipName] = null
      }

      for (let loadedRelationship of loadedRelationships) {
        if (row[relationship.thisId] == loadedRelationship[relationship.otherId]) {
          if (relationship.oneToMany === true) {
            l.dev('Pushing into array of one-to-many...', loadedRelationship)
            row[relationshipToLoad.relationshipName].push(loadedRelationship)
          }
          else {
            l.dev('Setting property of many-to-one..', loadedRelationship)
            row[relationshipToLoad.relationshipName] = loadedRelationship
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

export async function update(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: UpdateCriteria): Promise<any[]> {
  let l = log.fn('update')
  l.param('tableName', tableName)
  l.param('criteria', criteria)

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = new Query
  query.update(tableName)

  for (let column of Object.keys(table.columns)) {
    if (criteria[column] !== undefined) {
      let value = criteria[column]
      query.set(column, value)
    }
  }

  addCriteria(schema, tableName, query, criteria['@criteria'])

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

export async function delete_(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: Criteria): Promise<any[]> {
  let l = log.fn('delete_')
  l.param('tableName', tableName)
  l.param('criteria', criteria)

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = new Query
  query.deleteFrom(tableName)
  addCriteria(schema, tableName, query, criteria)

  if (db == 'postgres') {
    query.returning('*')
  }

  let sqlString = query.sql(db)
  let values = query.values()

  l.lib('SQL string', sqlString)
  l.lib('Values', values)

  let deletedRows = await queryFn(sqlString, values)
  
  l.returning('Returning deleted rows...', deletedRows)
  return deletedRows
}

export interface CriteriaIssue {
  location: string
  message: string
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
