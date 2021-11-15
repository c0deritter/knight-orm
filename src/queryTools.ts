import { Criteria, isCriteriaComparison, Operator } from 'knight-criteria'
import { Log } from 'knight-log'
import { comparison, Condition, Query, Join, From } from 'knight-sql'
import { Schema } from './Schema'

let log = new Log('knight-orm/queryTools.ts')

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

      l.lib('Add sub criteria through recursion', arrayValue)
      addCriteria(schema, tableName, query, arrayValue as any, alias, subCondition)
    }
  }
  else if (typeof criteria == 'object') {
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

export function selectAllColumnsExplicitly(schema: Schema, query: Query) {
  if (query._from && query._from.pieces) {
    for (let from of query._from.pieces) {
      if (from instanceof From) {
        let fromTable = schema[from.table]
  
        if (fromTable == undefined) {
          throw new Error('Table not contained in schema: ' + from.table)
        }
    
        for (let column of Object.keys(fromTable.columns)) {
          let alias = from.alias != undefined && from.alias.length > 0 ? from.alias : undefined
          query.select((alias != undefined ? alias + '.' : '') + column + ' ' + (alias != undefined ? '"' + alias + '__' + column + '"' : ''))
        }  
      }
    }
  }

  if (query._join && query._join.pieces) {
    for (let join of query._join.pieces) {
      if (join instanceof Join) {
        let joinTable = schema[join.table]
  
        if (joinTable == undefined) {
          throw new Error('Table not contained in schema: ' + join.table)
        }
    
        for (let column of Object.keys(joinTable.columns)) {
          let alias = join.alias != undefined && join.alias.length > 0 ? join.alias : undefined
          query.select((alias != undefined ? alias + '.' : '') + column + ' ' + (alias != undefined ? '"' + alias + '__' + column + '"' : ''))
        }  
      }
    }
  }
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
