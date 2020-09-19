import { Criteria, ReadCriteria } from 'mega-nice-criteria'
import { Query } from 'mega-nice-sql'
import { fillCriteria, fillReadCriteria } from 'mega-nice-sql-criteria-filler'
import { Schema } from './Schema'

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

export function joinRelationships(schema: Schema, tableName: string, query: Query, criteria: Criteria, alias?: string) {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  // console.debug('Iterating through all properties of the table object which contain the relationships...')
  for (let relationshipName of Object.keys(table)) {
    // console.debug('relationshipName', relationshipName)
    
    if (relationshipName == 'table' || relationshipName == 'columns') {
      // console.debug('Relationship name is \'table\' or \'columns\'. Continuing...')
      continue
    }

    if (! (relationshipName in criteria)) {
      // console.debug('Relationship is not contained in the criteria. Continuing...')
      continue
    }

    let relationship = table[relationshipName]
    let relationshipCriteria = criteria[relationshipName]
    // console.debug('relationship', relationship)
    // console.debug('relationshipCriteria', relationshipCriteria)
    
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

    // console.debug('thisId', thisId)
    // console.debug('otherTableName', otherTableName)
    // console.debug('otherId', otherId)

    let joinAlias = alias != undefined && alias.length > 0 ? alias + '__' + relationshipName : relationshipName

    // console.debug('joinAlias', joinAlias)
    
    // console.debug('Adding INNER JOIN to query')
    query.join('INNER', otherTableName, joinAlias, '' + (alias != undefined && alias.length > 0 ? alias + '.' : '') + thisId + ' = ' + joinAlias + '.' + otherId)
    // console.debug('query', query)

    let otherTable = schema[otherTableName]

    if (otherTable == undefined) {
      throw new Error('Table not contained in schema: ' + otherTable)
    }

    // console.debug('Filling query with the relationship criteria')
    fillCriteria(query, relationshipCriteria, Object.keys(otherTable.columns), joinAlias)
    // console.debug('query', query)

    joinRelationships(schema, otherTableName, query, relationshipCriteria, joinAlias)
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
      query.select((alias != undefined ? alias + '.' : '' ) + column, (alias != undefined ? alias + '__' + column : undefined))
    }
  }

  for (let join of query._joins) {
    let joinTable = schema[join.table]
    
    if (joinTable == undefined) {
      throw new Error('Table not contained in schema: ' + join.table)
    }

    for (let column of Object.keys(joinTable.columns)) {
      let alias = join.alias != undefined && join.alias.length > 0 ? join.alias : undefined
      query.select((alias != undefined ? alias + '.' : '' ) + column, (alias != undefined ? alias + '__' + column : undefined))
    }
  }
}
