import { Criteria, isCriteriaEmpty, ReadCriteria } from 'mega-nice-criteria'
import Log from 'mega-nice-log'
import { Query } from 'mega-nice-sql'
import { fillCriteria, fillReadCriteria } from 'mega-nice-sql-criteria-filler'
import { Schema } from './Schema'

let log = new Log('mega-nice-sql-orm/queryTools.ts')

export function buildSelectQuery(schema: Schema, tableName: string, criteria: ReadCriteria): Query {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = new Query
  query.from(tableName, tableName)

  fillReadCriteria(query, criteria, Object.keys(schema[tableName].columns))
  joinRelationships(schema, tableName, query, criteria, tableName)
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

  fillReadCriteria(query, criteria, Object.keys(schema[tableName].columns))
  joinRelationships(schema, tableName, query, criteria, tableName)

  return query
}

/**
 * It will join any relationship into the given query that are either tagged with
 * the property '@filterGlobally' or which are empty. Thus relationship criteria
 * that should not influence the overall selected rows have to be loaded in a dedicated
 * query.
 * 
 * @param schema 
 * @param tableName 
 * @param query 
 * @param criteria 
 * @param alias 
 */
export function joinRelationships(schema: Schema, tableName: string, query: Query, criteria: Criteria, alias?: string) {
  let l = log.fn('joinRelationships')

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  l.user('Iterating through all properties of the table object which contain the relationships...')
  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.var('relationshipName', relationshipName)
      
      if (relationshipName == 'table' || relationshipName == 'columns') {
        l.user('Relationship name is \'table\' or \'columns\'. Continuing...')
        continue
      }
  
      if (! (relationshipName in criteria)) {
        l.user('Relationship is not contained in the criteria. Continuing...')
        continue
      }

      let relationship = table.relationships[relationshipName]
      let relationshipCriteria = criteria[relationshipName]
      l.var('relationship', relationship)
      l.var('relationshipCriteria', relationshipCriteria)

      // 1. if the property @filterGlobally is set to true then we need to join
      // 2. if there are not any relationship criteria then we also can join
      if (relationshipCriteria['@filterGlobally'] === true || isCriteriaEmpty(relationshipCriteria)) {
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
    
        l.var('thisId', thisId)
        l.var('otherTableName', otherTableName)
        l.var('otherId', otherId)
    
        let joinAlias = alias != undefined && alias.length > 0 ? alias + '__' + relationshipName : relationshipName
        l.var('joinAlias', joinAlias)
        
        l.user('Adding LEFT JOIN to query')
        query.join('LEFT', otherTableName, joinAlias, '' + (alias != undefined && alias.length > 0 ? alias + '.' : '') + thisId + ' = ' + joinAlias + '.' + otherId)
        l.var('query', query)
    
        let otherTable = schema[otherTableName]
    
        if (otherTable == undefined) {
          throw new Error('Table not contained in schema: ' + otherTable)
        }
    
        l.user('Filling query with the relationship criteria')
        fillCriteria(query, relationshipCriteria, Object.keys(otherTable.columns), joinAlias)
        l.var('query', query)
    
        l.user('Join the relationships of the relationship. Going into recursion...')
        joinRelationships(schema, otherTableName, query, relationshipCriteria, joinAlias)
        l.user(`Coming back from recursing into '${relationshipName}'...`)
      }
    }  
  }
}

export function selectAllColumnsExplicitly(schema: Schema, query: Query) {
  for (let from of query._froms) {
    let fromTable = schema[from.table]
    
    if (fromTable == undefined) {
      throw new Error('Table not contained in schema: ' + from.table)
    }

    for (let column of Object.keys(fromTable.columns)) {
      let alias = from.alias != undefined && from.alias.length > 0 ? from.alias : undefined
      query.select((alias != undefined ? alias + '.' : '' ) + column, (alias != undefined ? '"' + alias + '__' + column + '"' : undefined))
    }
  }

  for (let join of query._joins) {
    let joinTable = schema[join.table]
    
    if (joinTable == undefined) {
      throw new Error('Table not contained in schema: ' + join.table)
    }

    for (let column of Object.keys(joinTable.columns)) {
      let alias = join.alias != undefined && join.alias.length > 0 ? join.alias : undefined
      query.select((alias != undefined ? alias + '.' : '' ) + column, (alias != undefined ? '"' + alias + '__' + column + '"' : undefined))
    }
  }
}
