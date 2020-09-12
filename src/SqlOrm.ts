import { Criteria, ReadCriteria } from 'mega-nice-criteria'
import { Query } from 'mega-nice-sql'
import { fillReadCriteria, fillCriteria } from 'mega-nice-sql-criteria-filler'
import { Schema, Table, relationshipsOnly } from './Schema'

export class SqlOrm {

  schema: Schema
  
  constructor(schema: Schema) {
    this.schema = schema
  }

  add(...tables: Table[]) {
    for (let table of tables) {
      this.schema[table.name] = table
    }
  }

  buildSelectQuery(tableName: string, criteria: ReadCriteria): Query {
    let table = this.schema[tableName]

    if (table == undefined) {
      throw new Error('Table not contained in schema: ' + tableName)
    }

    let query = new Query
    query.from(tableName, tableName)

    fillReadCriteria(query, criteria, this.schema[tableName].columns)
    joinRelationships(tableName, this.schema, query, criteria, tableName)
    selectAllColumnsExplicitly(this.schema, query)

    return query
  }

  buildCountQuery(tableName: string, criteria: Criteria): Query {
    let table = this.schema[tableName]

    if (table == undefined) {
      throw new Error('Table not contained in schema: ' + tableName)
    }

    let query = new Query
    query.from(tableName, tableName).select('COUNT(*)')

    fillReadCriteria(query, criteria, this.schema[tableName].columns)
    joinRelationships(tableName, this.schema, query, criteria, tableName)

    return query
  }

  rowsToInstances(tableName: string, rows: any[], criteria: ReadCriteria, alias?: string, rowFilter?: any): any[]  {
    // console.debug('Entering rowsToInstances...')
    // console.debug('rows', rows)
    // console.debug('criteria', criteria)
    // console.debug('tableName', tableName)
    // console.debug('alias', alias)
    // console.debug('rowFilter', rowFilter)

    alias = alias != undefined ? alias : tableName + '__'

    let table = this.schema[tableName]
    // console.debug('table', table)

    if (table == undefined) {
      throw new Error('Table not contained in schema: ' + tableName)
    }

    let relationships = relationshipsOnly(table)
    let instances: any[] = []

    // console.debug('relationships', relationships)

    // console.debug('Iterating over all rows...')
    for (let row of rows) {
      // console.debug('row', row)

      if (! isRowRelevant(row, rowFilter)) {
        // console.debug('Row is not relevant. Continuing...')
        continue
      }

      let instance = table.rowToInstance(row, alias != undefined ? alias : '')
      // console.debug('instance', instance)
      instances.push(instance)

      let instanceAsRow = instanceRelevantCells(row, table, alias)
      // console.debug('instanceAsRow', instanceAsRow)

      // console.debug('Iterating over all relationships...')
      for (let relationshipName of Object.keys(relationships)) {
        // console.debug('relationshipName', relationshipName)
        
        let relationship = relationships[relationshipName]
        // console.debug('relationship', relationship)

        if (! (relationshipName in criteria)) {
          // console.debug('Relationship is not contained in criteria. Continuing...')
          continue
        }

        let relationshipTableName = relationship.oneToMany != undefined ? relationship.oneToMany.otherTable : relationship.manyToOne!.otherTable
        let relationshipAlias = alias != undefined ? alias + relationshipName + '__' : relationshipName + '__'

        // console.debug('relationshipTableName', relationshipTableName)
        // console.debug('relationshipAlias', relationshipAlias)
        
        let relationshipRowFilter
        if (rowFilter != undefined) {
          relationshipRowFilter = {
            ...rowFilter,
            ...instanceAsRow
          }
        }
        else {
          relationshipRowFilter = instanceAsRow
        }

        // console.debug('relationshipRowFilter', relationshipRowFilter)
        
        // console.debug('Determining all relationship instances. Going into recursion...')
        let relationshipInstances = this.rowsToInstances(relationshipTableName, rows, criteria[relationshipName], relationshipAlias, relationshipRowFilter)
        // console.debug('Coming back from recursion...', relationshipInstances)

        if (relationship.oneToMany != undefined) {
          // console.debug('Attaching one-to-many instances...')
          instance[relationshipName] = relationshipInstances
        }
        else if (relationship.manyToOne != undefined) {
          // console.debug('Attaching many-to-one instance...')
          instance[relationshipName] = relationshipInstances[0]
        }
        else {
          // console.debug('Not attaching anything...', relationship)
        }
      }
    }

    // console.debug('Returning instances...', instances)
    return instances
  }
}

function joinRelationships(tableName: string, schema: Schema, query: Query, criteria: Criteria, alias?: string) {
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
    
    let thisId
    let otherTableName
    let otherId

    if (typeof relationship.oneToMany == 'object' && relationship.oneToMay !== null) {
      // console.debug('We have a oneToMany relationship')
      thisId = relationship.oneToMany.thisId
      otherTableName = relationship.oneToMany.otherTable
      otherId = relationship.oneToMany.otherId
    }
    else if (typeof relationship.manyToOne == 'object' && relationship.manyToOne !== null) {
      // console.debug('We have a manyToOne relationship')
      thisId = relationship.manyToOne.thisId
      otherTableName = relationship.manyToOne.otherTable
      otherId = relationship.manyToOne.otherId
    }
    else {
      throw new Error('Given criteria do not contain oneToMany nor manyToOne')
    }

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
    fillCriteria(query, relationshipCriteria, otherTable.columns, joinAlias)
    // console.debug('query', query)

    joinRelationships(otherTableName, schema, query, relationshipCriteria, joinAlias)
  }
}

function selectAllColumnsExplicitly(schema: Schema, query: Query) {
  for (let from of query._froms) {
    let fromTable = schema[from.table]
    
    if (fromTable == undefined) {
      throw new Error('Table not contained in schema: ' + from.table)
    }

    for (let column of fromTable.columns) {
      let alias = from.alias != undefined && from.alias.length > 0 ? from.alias : undefined
      query.select((alias != undefined ? alias + '.' : '' ) + column, (alias != undefined ? alias + '__' + column : undefined))
    }
  }

  for (let join of query._joins) {
    let joinTable = schema[join.table]
    
    if (joinTable == undefined) {
      throw new Error('Table not contained in schema: ' + join.table)
    }

    for (let column of joinTable.columns) {
      let alias = join.alias != undefined && join.alias.length > 0 ? join.alias : undefined
      query.select((alias != undefined ? alias + '.' : '' ) + column, (alias != undefined ? alias + '__' + column : undefined))
    }
  }
}

function isRowRelevant(row: any, filter: any): boolean {
  if (filter == undefined) {
    return true
  }

  for (let property of Object.keys(filter)) {
    if (row[property] !== filter[property]) {
      return false
    }
  }

  return true
}

function instanceRelevantCells(row: any, table: Table, alias?: string) {
  let relevantCells: any = {}

  for (let column of table.columns) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column
    relevantCells[aliasedColumn] = row[aliasedColumn]
  }

  return relevantCells
}