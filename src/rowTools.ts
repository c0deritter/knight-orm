import { ReadCriteria } from 'mega-nice-criteria'
import { getRelationshipNames, isId, Schema, Table } from './Schema'

export function instanceToRow(schema: Schema, tableName: string, instance: any): any {
  let table = schema[tableName]
  // console.debug('table', table)

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let row = table.instanceToRow(instance)

  for (let relationshipName in getRelationshipNames(table)) {
    if (relationshipName in instance) {
      row[relationshipName] = instanceToRow(schema, table[relationshipName].otherTable, instance[relationshipName])
    }
  }
}

export function rowsToInstances(schema: Schema, tableName: string, rows: any[], criteria: ReadCriteria, alias?: string, rowFilter?: any): any[]  {
  // console.debug('Entering rowsToInstances...')
  // console.debug('rows', rows)
  // console.debug('criteria', criteria)
  // console.debug('tableName', tableName)
  // console.debug('alias', alias)
  // console.debug('rowFilter', rowFilter)

  alias = alias != undefined ? alias : tableName + '__'

  let table = schema[tableName]
  // console.debug('table', table)

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let relationshipNames = getRelationshipNames(table)
  let instances: any[] = []

  // console.debug('relationships', relationships)

  // console.debug('Iterating over all rows...')
  for (let row of rows) {
    // console.debug('row', row)

    if (! isRowRelevant(row, rowFilter)) {
      // console.debug('Row is not relevant. Continuing...')
      continue
    }

    let unaliasedRow = instanceRelevantCellsWithoutAlias(table, row, alias)
    let instance = table.rowToInstance(unaliasedRow)
    // console.debug('instance', instance)
    instances.push(instance)

    let instanceAsRow = instanceRelevantCells(table, row, alias)
    // console.debug('instanceAsRow', instanceAsRow)

    // console.debug('Iterating over all relationships...')
    for (let relationshipName of relationshipNames) {
      // console.debug('relationshipName', relationshipName)
      
      let relationship = table[relationshipName]
      // console.debug('relationship', relationship)

      if (! (relationshipName in criteria)) {
        // console.debug('Relationship is not contained in criteria. Continuing...')
        continue
      }

      let relationshipTableName = relationship.otherTable
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
      let relationshipInstances = rowsToInstances(schema, relationshipTableName, rows, criteria[relationshipName], relationshipAlias, relationshipRowFilter)
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

export function isRowRelevant(row: any, filter: any): boolean {
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

export function idsOnly(table: Table, row: any): any {
  let idsOnly: any = {}
  
  for (let column of Object.keys(table.columns)) {
    if (isId(table.columns[column])) {
      idsOnly[column] = row[column]
    }
  }

  return idsOnly
}

export function instanceRelevantCells(table: Table, row: any, alias?: string): any {
  let relevantCells: any = {}

  for (let column of Object.keys(table.columns)) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column
    relevantCells[aliasedColumn] = row[aliasedColumn]
  }

  return relevantCells
}

export function instanceRelevantCellsWithoutAlias(table: Table, row: any, alias?: string): any {
  let relevantCells: any = {}

  for (let column of Object.keys(table.columns)) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column
    relevantCells[column] = row[aliasedColumn]
  }

  return relevantCells
}