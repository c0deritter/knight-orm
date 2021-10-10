import { Criteria, isComparison, Operator } from 'knight-criteria'
import { Log } from 'knight-log'
import { comparison, Condition, Query } from 'knight-sql'
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
    condition = query._where
  }
  else {
    condition.removeOuterLogicalOperators = true
  }

  if (criteria instanceof Array) {
    l.libUser('Given criteria is an array')

    let logical = 'OR'

    for (let arrayValue of criteria) {
      if (typeof arrayValue == 'string') {
        let upperCase = arrayValue.toUpperCase()

        if (upperCase == 'AND' || upperCase == 'OR' || upperCase == 'XOR') {
          logical = upperCase
          l.libUser('Setting logical operator to', logical)
          continue
        }
      }

      l.libUser('Adding logical operator', logical)
      condition.push(logical)

      let subCondition = new Condition
      subCondition.surroundWithBrackets = true
      condition.push(subCondition)

      l.libUser('Add sub criteria through recursion', arrayValue)
      addCriteria(schema, tableName, query, arrayValue as any, undefined, subCondition)
    }
  }
  else if (typeof criteria == 'object') {
    l.libUser('Given criteria are an object')

    let aliasPrefix = alias != undefined && alias.length > 0 ? alias + '.' : ''
    let columns = Object.keys(table.columns)

    l.libUser('Iterating through all columns', columns)

    for (let column of columns) {
      l.location = [column]

      if (criteria[column] === undefined) {
        l.libUser('Skipping column because it is not contained in the given criteria')
        continue
      }

      let value: any = criteria[column]
      l.libUser('Processing column using criterium', value)

      l.libUser('Adding logical operator AND')
      condition.push('AND')

      if (isComparison(value)) {
        l.libUser('Given object represents a comparison')

        let operator = value['@operator'].toUpperCase()

        if (!(operator in Operator)) {
          l.libUser(`Operator '${operator}' is not supported. Continuing...`)
          continue
        }

        if (value['@value'] !== undefined) {
          l.libUser('Adding comparison')
          condition.push(comparison(aliasPrefix + column, operator, value['@value']))
        }
        else {
          l.libUser('Not adding comparison because the value is undefined')
        }
      }

      else if (value instanceof Array) {
        l.libUser('The given criterium is an array')

        let atLeastOneComparison = false

        for (let arrayValue of value) {
          if (isComparison(arrayValue)) {
            atLeastOneComparison = true
            break
          }
        }

        if (!atLeastOneComparison) {
          l.libUser('Array represents an SQL IN operation')
          condition.push(comparison(aliasPrefix + column, value))
        }
        else {
          l.libUser('Array represents connected comparisons')

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
                l.libUser('Setting logical operator to', logical)
                continue
              }
            }

            if (isComparison(arrayValue)) {
              if (arrayValue['@value'] === undefined) {
                l.libUser('Skipping comparison because its value is undefined', arrayValue)
                continue
              }

              l.libUser('Processing comparison', arrayValue)

              let operator = arrayValue['@operator'].toUpperCase()

              if (!(operator in Operator)) {
                l.libUser(`Comparison operator '${operator}' is not supported. Continuing...`)
                continue
              }

              l.libUser('Adding logical operator', logical)
              subCondition.pieces.push(logical)

              let comp = comparison(aliasPrefix + column, operator, arrayValue['@value'])
              l.libUser('Adding comparison', comp)
              subCondition.pieces.push(comp)
            }

            l.libUser('Setting logical operator back to the default OR')
            logical = 'OR'
          }

          l.libUser('Created brackets', subCondition)
        }
      }
      else {
        let comp = comparison(aliasPrefix + column, value)
        l.libUser('Adding comparison with default operator =', comp)
        condition.push(comp)
      }
    }

    l.location = undefined

    if (table.relationships != undefined) {
      let relationships = Object.keys(table.relationships)
      l.libUser('Iterating through all relationships', relationships)

      for (let relationshipName of relationships) {
        l.location = [ relationshipName ]

        if (!(relationshipName in criteria)) {
          l.libUser('Skipping relationship because it is not contained in the given criteria')
          continue
        }

        let relationship = table.relationships[relationshipName]
        let relationshipCriteria = criteria[relationshipName]
        let otherTable = schema[relationship.otherTable]

        if (otherTable == undefined) {
          throw new Error('Table not contained in schema: ' + relationship.otherTable)
        }

        l.libUser('Processing given criterium', relationshipCriteria)

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
          l.libUser('Adding LEFT JOIN to query', query._join[query._join.length - 1])

          let otherTable = schema[otherTableName]

          if (otherTable == undefined) {
            throw new Error('Table not contained in schema: ' + otherTable)
          }

          l.libUser('Filling query with the relationship criteria')
          addCriteria(schema, otherTableName, query, relationshipCriteria, joinAlias)
        }
      }
    }
  }
  else {
    l.warn('Given criteria type is not supported. It needs to be either an object or an array.', typeof criteria)
  }
}

export function selectAllColumnsExplicitly(schema: Schema, query: Query) {
  for (let from of query._from) {
    let fromTable = schema[from.table]

    if (fromTable == undefined) {
      throw new Error('Table not contained in schema: ' + from.table)
    }

    for (let column of Object.keys(fromTable.columns)) {
      let alias = from.alias != undefined && from.alias.length > 0 ? from.alias : undefined
      query.select((alias != undefined ? alias + '.' : '') + column + ' ' + (alias != undefined ? '"' + alias + '__' + column + '"' : ''))
    }
  }

  for (let join of query._join) {
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
