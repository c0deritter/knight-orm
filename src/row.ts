import { Criteria, summarizeCriteria } from 'knight-criteria'
import { Log } from 'knight-log'
import sql, { comparison } from 'knight-sql'
import { checkSchema, databaseIndependentQuery, getNotGeneratedPrimaryKeyColumns, isGeneratedPrimaryKeyColumn, SelectResult } from '.'
import { getPrimaryKey, getPropertyName, isPrimaryKeyColumn, Schema, Table } from './Schema'

let log = new Log('knight-orm/rowTools.ts')

class AlreadyConverted {
  instancesAndRows: { instance: any, row: any }[] = []

  add(instance: any, row: any) {
    this.instancesAndRows.push({ instance: instance, row: row })
  }

  getRow(instance: any) {
    for (let instanceAndRow of this.instancesAndRows) {
      if (instanceAndRow.instance === instance) {
        return instanceAndRow.row
      }
    }
  }

  getInstance(row: any) {
    for (let instanceAndRow of this.instancesAndRows) {
      if (instanceAndRow.row === row) {
        return instanceAndRow.instance
      }
    }
  }
}

export function instanceToRow(schema: Schema, tableName: string, instance: any, alreadyConverted: AlreadyConverted = new AlreadyConverted): any {
  let l = log.fn('instanceToRow')
  l.param('tableName', tableName)
  l.param('instance', instance)
  l.param('alreadyConverted', alreadyConverted.instancesAndRows)

  let row = alreadyConverted.getRow(instance)
  if (row != undefined) {
    l.lib('Row was already converted. Returning it...', row)
    return row
  }

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  if (typeof table.columns != 'object' || table.columns === null) {
    throw new Error('Table does not contain any column definitions: ' + tableName)
  }

  row = {}
  for (let columnName of Object.keys(table.columns)) {
    let propertyName = getPropertyName(table, columnName)
    
    if (propertyName != undefined && propertyName in instance) {
      row[columnName] = instance[propertyName]
    }
  }

  l.lib('Created row through simple copying of the values from the instance', row)

  if (typeof table.instanceToRow == 'function') {
    l.calling('Additionally applying custom instanceToRow function')
    row = table.instanceToRow(instance, row)
    l.called('Custom instanceToRow function applied', row)
  }

  alreadyConverted.add(instance, row)

  if (table.relationships != undefined) {
    let relationshipNames = Object.keys(table.relationships)

    if (relationshipNames.length > 0) {
      l.lib('Iterating through relationships', relationshipNames)
      l.location = []

      for (let relationshipName of relationshipNames) {
        l.location[0] = relationshipName
        l.lib('Processing next relationship', relationshipName)
    
        if (typeof instance[relationshipName] == 'object' && instance[relationshipName] !== null) {
          let relationship = table.relationships[relationshipName]
    
          if (relationship.manyToOne) {
            l.calling('Relationship is many-to-one. Converting relationship instance by using recursion.')
            let relationshipRow = instanceToRow(schema, relationship.otherTable, instance[relationshipName], alreadyConverted)
            l.called('Converted relationship instance', relationshipRow)
            row[relationshipName] = relationshipRow
          }
          else if (instance[relationshipName] instanceof Array) {
            l.lib('Relationship is one-to-many. Converting every relationship instance...')
    
            if (row[relationshipName] == undefined) {
              row[relationshipName] = []
            }

            for (let relationshipInstance of instance[relationshipName]) {
              l.calling('Converting next relationship instance by using recursion')
              let relationshipRow = instanceToRow(schema, relationship.otherTable, relationshipInstance, alreadyConverted)
              l.called('Converted relationship instance')
        
              row[relationshipName].push(relationshipRow)
            }        
          }
          else {
            l.warn('Relationship is one-to-many but given relationship row object is not of type array', instance[relationshipName])
          }
        }
        else if (instance[relationshipName] !== undefined) {
          l.lib('Relationship is not an object and not undefined which is invalid. Assigning it to row as it is.')
          row[relationshipName] = instance[relationshipName]
        }
        else {
          l.lib('Relationship does not exist on this instance. Continuing...')
        }
      }

      l.location = undefined
    }
  }

  l.returning('Returning row', row)
  return row
}

export function rowToInstance(schema: Schema, tableName: string, row: any, alreadyConverted: AlreadyConverted = new AlreadyConverted): any {
  let l = log.fn('rowToInstance')
  l.param('tableName', tableName)
  l.param('row', row)
  l.param('alreadyConverted', alreadyConverted.instancesAndRows)

  let instance = alreadyConverted.getInstance(row)
  if (instance != undefined) {
    l.lib('Instance was already converted. Returning it...', instance)
    return instance
  }

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  if (typeof table.columns != 'object' || table.columns === null) {
    throw new Error('Table does not contain any column definitions: ' + tableName)
  }

  instance = table.newInstance()

  for (let columnName of Object.keys(table.columns)) {
    if (columnName in row) {
      let propertyName = getPropertyName(table, columnName)
      
      if (propertyName != undefined) {
        instance[propertyName] = row[columnName]
      }
    }
  }

  l.lib('Created instance through simple copying of the values from the row', instance)

  if (typeof table.rowToInstance == 'function') {
    l.calling('Additionally applying custom rowToInstance function')
    instance = table.rowToInstance(row, instance)
    l.called('Custom rowToInstance function applied', instance)
  }

  alreadyConverted.add(instance, row)

  l.lib('Converting relationships...')

  if (table.relationships != undefined) {
    let relationshipNames = Object.keys(table.relationships)

    if (relationshipNames.length > 0) {
      l.lib('Iterating through relationships', relationshipNames)
      l.location = []

      for (let relationshipName of relationshipNames) {
        l.location[0] = relationshipName
        l.lib('Processing next relationship', relationshipName)
  
        if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
          let relationship = table.relationships[relationshipName]
    
          if (relationship.manyToOne) {
            l.calling('Relationship is many-to-one. Converting relationship row by using recursion.')
            let relationshipInstance = rowToInstance(schema, table.relationships[relationshipName].otherTable, row[relationshipName], alreadyConverted)
            l.called('Converted relationship instance')
            l.lib('Setting converted relationship instance')
            instance[relationshipName] = relationshipInstance
          }
          else if (row[relationshipName] instanceof Array) {
            l.lib('Relationship is one-to-many. Converting every relationship instance...')
    
            if (instance[relationshipName] == undefined) {
              instance[relationshipName] = []
            }

            for (let relationshipRow of row[relationshipName]) {
              l.calling('Converting next relationship row by using recursion')
              let relationshipInstance = rowToInstance(schema, table.relationships[relationshipName].otherTable, relationshipRow, alreadyConverted)
              l.called('Converted relationship instance')
              l.lib('Adding converted relationship instance')
              instance[relationshipName].push(relationshipInstance)
            }        
          }
        }
        else if (row[relationshipName] !== undefined) {
          l.lib('Relationship is not an object and not undefined which is invalid. Assigning it to instance as it is.')
          row[relationshipName] = instance[relationshipName]
        }
        else {
          l.lib('Relationship is not set. Continuing...')
        }
      }

      l.location = undefined
    }
  }

  l.returning('Returning instance...' ,instance)
  return instance
}

export async function isUpdate(
  schema: Schema,
  tableName: string,
  db: string,
  queryFn: (sqlString: string, values?: any[]) => Promise<any>,
  row: any
): Promise<boolean> {
  
  let l = log.fn('isUpdate')
  l.param('tableName', tableName)
  l.param('db', db)
  l.param('row', row)

  checkSchema(schema, tableName)
  let table = schema[tableName]

  if (! areAllNotGeneratedPrimaryKeyColumnsSet(table, row)) {
    throw new Error(`At least one not generated primary key column (${getNotGeneratedPrimaryKeyColumns(table).join(', ')}) is not set. Enable logging for more details.`)
  }

  let hasNotGeneratedPrimaryKeys = false
  let generatedPrimaryKeyCount = 0
  let generatedPrimaryKeyIsNull = true
  let generatedPrimaryKeyIsNotNull = true

  for (let column of getPrimaryKey(table)) {
    if (isGeneratedPrimaryKeyColumn(table, column)) {
      generatedPrimaryKeyCount++

      if (row[column] == null) {
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

  if (generatedPrimaryKeyCount > 1) {
    throw new Error(`The table ${tableName} has more than one generated primary key which is not valid.`)
  }

  if (generatedPrimaryKeyCount == 1 && ! generatedPrimaryKeyIsNull && ! generatedPrimaryKeyIsNotNull) {
    throw new Error('There is a generated primary key which are null and generated primary keys which are not null. This is an inconsistent set of column values. Cannot determine if row is to be inserted or to be updated. Please enable logging for more details.')
  }

  if ((generatedPrimaryKeyCount == 1 && generatedPrimaryKeyIsNotNull || ! generatedPrimaryKeyCount) && hasNotGeneratedPrimaryKeys) {
    l.lib('The row has not generated primary key columns. Determining if the row was already inserted.')
    
    let query = sql.select('*').from(tableName)

    for (let column of getPrimaryKey(table)) {
      query.where(comparison(column, row[column]), 'AND')
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

  for (let column of Object.keys(table.columns)) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column

    if (aliasedColumn in joinedRow) {
      if (filteredRow == undefined) {
        filteredRow = {}
      }

      filteredRow[column] = joinedRow[aliasedColumn]

      if (filteredRow[column] !== null) {
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
export function unjoinRows(schema: Schema, tableName: string, joinedRows: any[], criteria: Criteria, alias: string): any[]  {
  let l = log.fn('unjoinRows')

  l.param('tableName', tableName)
  l.param('criteria', criteria)
  l.param('alias', alias)

  l.location = [ alias, '' ]

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let relationshipNames = table.relationships != undefined ? Object.keys(table.relationships) : []
  let relationshipToRows: { [relationshipName: string]: any[] } = {}

  let summarizedCriteria = summarizeCriteria(criteria)
  l.lib('Summarized criteria', summarizedCriteria)

  if (relationshipNames.length > 0) {
    l.lib('Unjoining relationships...', relationshipNames)
  }

  for (let relationshipName of relationshipNames) {
    l.location[1] = '> ' + relationshipName

    l.lib('Unjoining relationship', relationshipName)

    if (! (relationshipName in summarizedCriteria)) {
      l.lib('Relationship is not contained in criteria. Continuing...')
      continue
    }

    if (summarizedCriteria[relationshipName]['@load'] !== true) {
      l.lib('Relationship is not to be loaded. Skipping...')
      continue
    }

    let relationship = table.relationships![relationshipName]
    let relationshipTableName = relationship.otherTable
    let relationshipAlias = alias + relationshipName + '__'

    l.calling('Fetching all relationship rows. Calling unjoinRows again...')
    let relationshipRows = unjoinRows(schema, relationshipTableName, joinedRows, summarizedCriteria[relationshipName], relationshipAlias)
    l.called('Returning from fetching all relationship rows...')
    
    l.dev('Found relationship rows', relationshipRows)
    relationshipToRows[relationshipName] = relationshipRows

    l.lib('Continuing unjoining relationships...')
  }

  l.location[1] = ''

  if (relationshipNames.length > 0) {
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
    if (relationshipNames.length > 0) {
      l.lib('Adding relationships', relationshipNames)
    }

    for (let relationshipName of relationshipNames) {
      l.location[1] = '> ' + relationshipName

      l.lib('Adding relationship rows for relationship', relationshipName)

      let relationship = table.relationships![relationshipName]
      
      if (relationship.manyToOne) {
        l.dev('Relationship is many-to-one. Initializing property with null.')
        unjoinedRow[relationshipName] = null
      }
      else if (relationship.oneToMany) {
        l.dev('Relationship is one-to-many. Initializing property with empty array.')
        unjoinedRow[relationshipName] = []
      }

      l.dev('Iterating through every relationshop row...')

      for (let relationshipRow of relationshipToRows[relationshipName]) {
        if (unjoinedRow[relationship.thisId] === relationshipRow[relationship.otherId]) {
          if (relationship.manyToOne) {
            l.lib('Setting many-to-one row', relationshipRow)
            unjoinedRow[relationshipName] = relationshipRow
            break
          }

          else if (relationship.oneToMany) {
            l.lib('Adding one-to-many row', relationshipRow)
            unjoinedRow[relationshipName].push(relationshipRow)
          }
        }

        else {
          l.dev('Relationship row was not related', relationshipRow)
        }
      }

      if (relationship.manyToOne && unjoinedRow[relationshipName] === null) {
        l.lib('No relationship row was found (many-to-one)')
      }
      else if (relationship.oneToMany && unjoinedRow[relationshipName].length == 0) {
        l.lib('No relationship rows were found (one-to-many)')
      }
    }

    l.location[1] = ''
  }

  l.returning('Returning unjoined rows...', unjoinedRows)
  return unjoinedRows
}

export function isPrimaryKeySet(table: Table, row: any): boolean {
  let primaryKey = getPrimaryKey(table)

  for (let column of primaryKey) {
    if (row[column] == null) {
      return false
    }
  }
  
  return true
}

export function areAllNotGeneratedPrimaryKeyColumnsSet(table: Table, row: any): boolean {
  let notGenerated = getNotGeneratedPrimaryKeyColumns(table)

  for (let column of notGenerated) {
    if (row[column] == null) {
      return false
    }
  }
  
  return true
}

export function rowsRepresentSameEntity(table: Table, row1: any, row2: any): boolean {
  if (row1 == undefined || row2 == undefined) {
    return false
  }

  let primaryKey = getPrimaryKey(table)

  if (primaryKey.length == 0) {
    return false
  }

  for (let column of primaryKey) {
    if (row1[column] === undefined || row1[column] !== row2[column]) {
      return false
    }
  }

  return true
}

export function instancesRepresentSameEntity(table: Table, instance1: any, instance2: any): boolean {
  if (instance1 == undefined || instance2 == undefined) {
    return false
  }
  
  let primaryKey = getPrimaryKey(table)

  if (primaryKey.length == 0) {
    return false
  }

  for (let column of primaryKey) {
    let property = getPropertyName(table, column)

    if (property != undefined && (instance1[property] === undefined || instance1[property] !== instance2[property])) {
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

export function reduceToPrimaryKeys(table: Table, row: any): any {
  let reduced: any = {}
  
  for (let column of Object.keys(table.columns)) {
    if (isPrimaryKeyColumn(table, column)) {
      reduced[column] = row[column]
    }
  }

  return reduced
}

export function areAllPrimaryKeyColumnsSet(table: Table, row: any): boolean {
  for (let column of getPrimaryKey(table)) {
    if (row[column] === undefined) {
      return false
    }
  }

  return true
}

export function reduceToColumnsOfTable(table: Table, row: any, alias?: string): any {
  let reduced: any = {}

  for (let column of Object.keys(table.columns)) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column
    reduced[aliasedColumn] = row[aliasedColumn]
  }

  return reduced
}

export function idsNotSet(table: Table, row: any): string[] {
  let idsNotSet = []

  for (let idColumn of getPrimaryKey(table)) {
    if (row[idColumn] === undefined) {
      idsNotSet.push(idColumn)
    }
  }

  return idsNotSet
}
