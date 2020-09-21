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

export function unjoinRows(schema: Schema, tableName: string, joinedRows: any[], criteria: ReadCriteria, toInstances: boolean = false, alias?: string, rowFilter?: any): any[]  {
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
  let rowsOrInstances: any[] = []

  // console.debug('relationships', relationships)

  // console.debug('Iterating over all rows...')
  for (let joinedRow of joinedRows) {
    // console.debug('row', row)

    if (! isRowRelevant(joinedRow, rowFilter)) {
      // console.debug('Row is not relevant. Continuing...')
      continue
    }

    let unaliasedRow = filterCellsOfTableAndRemoveAlias(table, joinedRow, alias)
    // console.debug('unaliasedRow', unaliasedRow)

    // if every column is null then there was no row in the first place
    let everyColumnIsNull = true
    for (let columnName of Object.keys(table.columns)) {
      if (unaliasedRow[columnName] !== null) {
        everyColumnIsNull = false
        break
      }
    }

    if (everyColumnIsNull) {
      // console.debug('Every column is null thus we have to assume that there was no row. Continuing...')
      continue
    }

    let rowOrInstance = toInstances ? table.rowToInstance(unaliasedRow) : unaliasedRow
    // console.debug('rowOrInstance', rowOrInstance)
    rowsOrInstances.push(rowOrInstance)

    let filteredRow = filterCellsOfTable(table, joinedRow, alias)
    // console.debug('filteredRow', filteredRow)

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
          ...filteredRow
        }
      }
      else {
        relationshipRowFilter = filteredRow
      }

      // console.debug('relationshipRowFilter', relationshipRowFilter)
      
      // console.debug('Determining all relationship instances. Going into recursion...')
      let relationshipInstances = unjoinRows(schema, relationshipTableName, joinedRows, criteria[relationshipName], toInstances, relationshipAlias, relationshipRowFilter)
      // console.debug('Coming back from recursion...', relationshipInstances)

      if (relationship.oneToMany && relationshipInstances.length > 0) {
        // console.debug('Attaching one-to-many instances...')
        rowOrInstance[relationshipName] = relationshipInstances
      }
      else if (relationship.manyToOne && relationshipInstances.length == 1) {
        // console.debug('Attaching many-to-one instance...')
        rowOrInstance[relationshipName] = relationshipInstances[0]
      }
      else {
        // console.debug('Not attaching anything...', relationship)
      }
    }
  }

  // console.debug('Returning instances...', instances)
  return rowsOrInstances
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

export function filterCellsOfTable(table: Table, row: any, alias?: string): any {
  let relevantCells: any = {}

  for (let column of Object.keys(table.columns)) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column
    relevantCells[aliasedColumn] = row[aliasedColumn]
  }

  return relevantCells
}

export function filterCellsOfTableAndRemoveAlias(table: Table, row: any, alias?: string): any {
  let relevantCells: any = {}

  for (let column of Object.keys(table.columns)) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column
    relevantCells[column] = row[aliasedColumn]
  }

  return relevantCells
}