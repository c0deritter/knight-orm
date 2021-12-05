import { Criteria, summarizeCriteria } from 'knight-criteria'
import { Log } from 'knight-log'
import sql, { comparison } from 'knight-sql'
import { databaseIndependentQuery, SelectResult } from './query'
import { Column, Table } from './schema'

let log = new Log('knight-orm/rowTools.ts')

export async function isUpdate(
  table: Table,
  db: string,
  queryFn: (sqlString: string, values?: any[]) => Promise<any>,
  row: any
): Promise<boolean> {
  
  let l = log.fn('isUpdate')
  l.param('table.name', table.name)
  l.param('db', db)
  l.param('row', row)

  if (! areAllNotGeneratedPrimaryKeyColumnsSet(table, row)) {
    throw new Error(`At least one not generated primary key column (${table.notGeneratedPrimaryKey.map(column => column.name).join(', ')}) is not set. Enable logging for more details.`)
  }

  let hasNotGeneratedPrimaryKeys = false
  let generatedPrimaryKeyCount = 0
  let generatedPrimaryKeyIsNull = true
  let generatedPrimaryKeyIsNotNull = true

  for (let column of table.primaryKey) {
    if (column.generated) {
      generatedPrimaryKeyCount++

      if (row[column.name] == null) {
        generatedPrimaryKeyIsNotNull = false
      }
      else {
        generatedPrimaryKeyIsNull = false
      }
    }
    else {
      hasNotGeneratedPrimaryKeys = true
    }
  }

  if (generatedPrimaryKeyCount == 1 && ! generatedPrimaryKeyIsNull && ! generatedPrimaryKeyIsNotNull) {
    throw new Error('There is a generated primary key which are null and generated primary keys which are not null. This is an inconsistent set of column values. Cannot determine if row is to be inserted or to be updated. Please enable logging for more details.')
  }

  if ((generatedPrimaryKeyCount == 1 && generatedPrimaryKeyIsNotNull || ! generatedPrimaryKeyCount) && hasNotGeneratedPrimaryKeys) {
    l.lib('The row has not generated primary key columns. Determining if the row was already inserted.')
    
    let query = sql.select('*').from(table.name)

    for (let column of table.primaryKey) {
      query.where(comparison(column.name, row[column.name]), 'AND')
    }

    let rows
    try {
      rows = await databaseIndependentQuery(db, queryFn, query.sql(db), query.values()) as SelectResult
    }
    catch (e) {
      throw new Error(e as any)
    }

    let alreadyInserted = rows.length == 1

    if (alreadyInserted) {
      l.lib('The row was already inserted')
    }
    else {
      l.lib('The row was not already inserted')
    }

    l.returning('Returning', alreadyInserted)
    return alreadyInserted
  }

  if (generatedPrimaryKeyCount == 1 && generatedPrimaryKeyIsNotNull) {
    l.lib('The row does not have not generated primary key columns and all generated primary key columns are not null.')
    l.returning('Returning true...')
  }
  else {
    l.lib('The row does not have not generated primary key columns and all generated primary key columns are null.')
    l.returning('Returning false...')
  }

  return generatedPrimaryKeyCount == 1 && generatedPrimaryKeyIsNotNull
}

/**
 * Gets a row consisting of multiple joined tables and unjoins a given table. It basically
 * means that it will extract the columns of the given table while removing their aliases.
 * 
 * @param table The table which is to be extracted from the given row
 * @param joinedRow A row which contains columns of multiple joined tables
 * @param alias The alias which was used to prefix every column of the given table
 * @returns An object which has only those properties who represent the columns of the given table.
 * If the row did not contain any column of the given table, undefined is returned.
 */
 export function unjoinTable(table: Table, joinedRow: any, alias?: string, returnUndefinedIfEveryColumnIsNull = false): any {
  let filteredRow: any = undefined
  let everyColumnIsNull = true

  for (let column of table.columns) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column.name : column.name

    if (aliasedColumn in joinedRow) {
      if (filteredRow == undefined) {
        filteredRow = {}
      }

      filteredRow[column.name] = joinedRow[aliasedColumn]

      if (filteredRow[column.name] !== null) {
        everyColumnIsNull = false
      }
    }
  }

  if (returnUndefinedIfEveryColumnIsNull && everyColumnIsNull) {
    return
  }

  return filteredRow
}

/**
 * Gets an array of rows which contain the columns of the base table and optionally additional
 * joined columns which refer to the base table through a many-to-one or one-to-many
 * relationship. It will create the corresponding object tree out of it.
 * 
 * @param schema The database schema which must contain the given table name
 * @param tableName The name of the table which must be contained in the given database schema
 * @param joinedRows A array of row objects containing root columns and joined columns
 * @param criteria The criteria which were used to create the given rows
 * @param alias The alias which was prepended to the column names in regard to the given table
 * @returns An array of row objects which relationships are unjoined
 */
export function unjoinRows(table: Table, joinedRows: any[], criteria: Criteria, alias: string): any[]  {
  let l = log.fn('unjoinRows')

  l.param('table.name', table.name)
  l.param('criteria', criteria)
  l.param('alias', alias)

  l.location = [ alias, '' ]

  let relationshipToRows: { [relationshipName: string]: any[] } = {}

  let summarizedCriteria = summarizeCriteria(criteria)
  l.lib('Summarized criteria', summarizedCriteria)

  if (table.relationships.length > 0) {
    l.lib('Unjoining relationships...')
  }

  for (let relationship of table.relationships) {
    l.location[1] = '> ' + relationship.name

    l.lib('Unjoining relationship', relationship.name)

    if (! (relationship.name in summarizedCriteria)) {
      l.lib('Relationship is not contained in criteria. Continuing...')
      continue
    }

    if (summarizedCriteria[relationship.name]['@load'] !== true) {
      l.lib('Relationship is not to be loaded. Skipping...')
      continue
    }

    let relationshipAlias = alias + relationship.name + '__'

    l.calling('Fetching all relationship rows. Calling unjoinRows again...')
    let relationshipRows = unjoinRows(relationship.otherTable, joinedRows, summarizedCriteria[relationship.name], relationshipAlias)
    l.called('Returning from fetching all relationship rows...')
    
    l.dev('Found relationship rows', relationshipRows)
    relationshipToRows[relationship.name] = relationshipRows

    l.lib('Continuing unjoining relationships...')
  }

  l.location[1] = ''

  if (table.relationships.length > 0) {
    l.lib('Finished unjoining relationships. Continuing with unjoining every row...')
  }
  else {
    l.lib('Unjoining rows...')
  }

  let unjoinedRows: any[] = []

  for (let joinedRow of joinedRows) {
    l.lib('Unjoining next row', joinedRow)

    let unjoinedRow = unjoinTable(table, joinedRow, alias, true)

    if (unjoinedRow == undefined) {
      l.lib('Given joined row did not contain any columns of the given table or every value was null. Skipping...')
      continue
    }

    l.lib('Unjoined row', unjoinedRow)

    let rowAlreadyUnjoined = false
    for (let alreadyUnjoinedRow of unjoinedRows) {
      if (rowsRepresentSameEntity(table, alreadyUnjoinedRow, unjoinedRow)) {
        rowAlreadyUnjoined = true
        break
      }
    }

    if (rowAlreadyUnjoined) {
      l.lib('Not adding unjoined row to result array because it was already added')
    }
    else {
      l.lib('Adding unjoined row to the result array')
      unjoinedRows.push(unjoinedRow)
    }

    let relationshipNames = Object.keys(relationshipToRows)
    if (table.relationships.length > 0) {
      l.lib('Adding relationships...')
    }

    for (let relationshipName of relationshipNames) {
      l.location[1] = '> ' + relationshipName
      let relationship = table.getRelationship(relationshipName)

      l.lib('Adding relationship rows for relationship', relationship.name)

      if (relationship.manyToOne) {
        l.dev('Relationship is many-to-one. Initializing property with null.')
        unjoinedRow[relationship.name] = null
      }
      else if (relationship.oneToMany) {
        l.dev('Relationship is one-to-many. Initializing property with empty array.')
        unjoinedRow[relationship.name] = []
      }

      l.dev('Iterating through every relationshop row...')

      for (let relationshipRow of relationshipToRows[relationship.name]) {
        if (unjoinedRow[relationship.thisId.name] === relationshipRow[relationship.otherId.name]) {
          if (relationship.manyToOne) {
            l.lib('Setting many-to-one row', relationshipRow)
            unjoinedRow[relationship.name] = relationshipRow
            break
          }

          else if (relationship.oneToMany) {
            l.lib('Adding one-to-many row', relationshipRow)
            unjoinedRow[relationship.name].push(relationshipRow)
          }
        }

        else {
          l.dev('Relationship row was not related', relationshipRow)
        }
      }

      if (relationship.manyToOne && unjoinedRow[relationship.name] === null) {
        l.lib('No relationship row was found (many-to-one)')
      }
      else if (relationship.oneToMany && unjoinedRow[relationship.name].length == 0) {
        l.lib('No relationship rows were found (one-to-many)')
      }
    }

    l.location[1] = ''
  }

  l.returning('Returning unjoined rows...', unjoinedRows)
  return unjoinedRows
}

export function isPrimaryKeySet(table: Table, row: any): boolean {
  for (let column of table.primaryKey) {
    if (row[column.name] == null) {
      return false
    }
  }
  
  return true
}

export function areAllNotGeneratedPrimaryKeyColumnsSet(table: Table, row: any): boolean {
  for (let column of table.notGeneratedPrimaryKey) {
    if (row[column.name] == null) {
      return false
    }
  }
  
  return true
}

export function rowsRepresentSameEntity(table: Table, row1: any, row2: any): boolean {
  if (row1 == undefined || row2 == undefined) {
    return false
  }

  if (table.primaryKey.length == 0) {
    return false
  }

  for (let column of table.primaryKey) {
    if (row1[column.name] === undefined || row1[column.name] !== row2[column.name]) {
      return false
    }
  }

  return true
}

export function instancesRepresentSameEntity(table: Table, instance1: any, instance2: any): boolean {
  if (instance1 == undefined || instance2 == undefined) {
    return false
  }
  
  if (table.primaryKey.length == 0) {
    return false
  }

  for (let column of table.primaryKey) {
    if (column.propertyName != undefined && (instance1[column.propertyName] === undefined || instance1[column.propertyName] !== instance2[column.propertyName])) {
      return false
    }
  }

  return true
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

export function reduceToPrimaryKey(table: Table, row: any): any {
  let reduced: any = {}
  
  for (let column of table.columns) {
    if (column.primaryKey) {
      reduced[column.name] = row[column.name]
    }
  }

  return reduced
}

export function reduceToColumnsOfTable(table: Table, row: any, alias?: string): any {
  let reduced: any = {}

  for (let column of table.columns) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column.name : column.name
    reduced[aliasedColumn] = row[aliasedColumn]
  }

  return reduced
}

export function idsNotSet(table: Table, row: any): Column[] {
  let idsNotSet: Column[] = []

  for (let column of table.primaryKey) {
    if (row[column.name] === undefined) {
      idsNotSet.push(column)
    }
  }

  return idsNotSet
}
