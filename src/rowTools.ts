import { Criteria, CriteriaObject } from 'knight-criteria'
import { Log } from 'knight-log'
import { getIdColumns, getPropertyName, isIdColumn, Schema, Table } from './Schema'

let log = new Log('knight-orm/rowTools.ts')

export function filterValidColumns(schema: Schema, tableName: string, row: any): any {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let filtered: any = {}
  
  for (let columnName of Object.keys(table.columns)) {
    if (columnName in row) {
      filtered[columnName] = row[columnName]
    }
  }

  return filtered
}

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
    l.lib('Instance was already converted. Returning it...', row)
    return row
  }

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  row = table.instanceToRow(instance)
  l.lib('row', row)

  alreadyConverted.add(instance, row)

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.lib('relationshipName', relationshipName)
  
      if (typeof instance[relationshipName] == 'object' && instance[relationshipName] !== null) {
        let relationship = table.relationships[relationshipName]
  
        if (relationship.manyToOne) {
          l.calling('Relationship is many-to-one. Going into recursion...')
          row[relationshipName] = instanceToRow(schema, relationship.otherTable, instance[relationshipName], alreadyConverted)
          l.called('Returning from recursion...')
        }
        else if (instance[relationshipName] instanceof Array) {
          l.lib('Relationship is one-to-many')
  
          for (let relationshipInstance of instance[relationshipName]) {
            l.lib('relationshipInstance', relationshipInstance)
            l.calling('Going into recursion...')
            let relationshipRow = instanceToRow(schema, relationship.otherTable, relationshipInstance, alreadyConverted)
            l.called('Returning from recursion...')
  
            if (row[relationshipName] == undefined) {
              row[relationshipName] = []
            }
  
            row[relationshipName].push(relationshipRow)
          }        
        }
        else {
          l.warn('Relationship is one-to-many but given relationship row object is not of type array', instance[relationshipName])
        }
      }
      else if (instance[relationshipName] !== undefined) {
        l.lib('Relationship is not an object and not undefined')
        row[relationshipName] = instance[relationshipName]
      }
      else {
        l.lib('Relationship does not exist on this instance. Continuing...')
      }
    }  
  }

  l.returning('Returning row...', row)
  return row
}

export function rowToInstance(schema: Schema, tableName: string, row: any, alreadyConverted: AlreadyConverted = new AlreadyConverted): any {
  let l = log.fn('rowToInstance')
  l.location = [ tableName ]
  l.param('row', row)
  l.param('alreadyConverted', alreadyConverted.instancesAndRows)

  let instance = alreadyConverted.getInstance(row)
  if (instance != undefined) {
    l.lib('Row was already converted. Returning it...')
    return instance
  }

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  instance = table.rowToInstance(row)
  l.lib('instance', instance)

  alreadyConverted.add(instance, row)

  l.lib('Converting relationships...')

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.location.push(' ' + relationshipName)
      l.dev('Converting next relationship...', relationshipName)
      l.location.push('.' + relationshipName)
      l.lib('row', row)
  
      if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
        let relationship = table.relationships[relationshipName]
  
        if (relationship.manyToOne) {
          l.calling('Converting many-to-one. Going into recursion...')
          let relationshipInstance = rowToInstance(schema, table.relationships[relationshipName].otherTable, row[relationshipName], alreadyConverted)
          l.called('Returning from recursion...')
          
          l.lib('Setting converted relationship instance...', relationshipInstance)
          l.lib('...on row', row)
          instance[relationshipName] = relationshipInstance
        }
        else if (row[relationshipName] instanceof Array) {
          l.lib('Relationship is one-to-many. Converting every relationship row...')
  
          for (let relationshipRow of row[relationshipName]) {
            l.lib('Converting next relationship row...', relationshipRow)
            l.lib('row', row)
            l.calling('Going into recursion...')
            let relationshipInstance = rowToInstance(schema, table.relationships[relationshipName].otherTable, relationshipRow, alreadyConverted)
            l.called('Returning from recursion...')
  
            if (instance[relationshipName] == undefined) {
              instance[relationshipName] = []
            }
  
            l.lib('Adding converted relationship instance to relationship array...', relationshipInstance)
            l.lib('...on row', row)
            instance[relationshipName].push(relationshipInstance)
          }        
        }
      }
      else if (row[relationshipName] !== undefined) {
        l.lib('Relationship is not an object but also not undefined. Setting given value without converting...')
        row[relationshipName] = instance[relationshipName]
      }
      else {
        l.lib('Relationship is not set. Continuing...')
      }

      l.location.pop()
    }
  }

  l.returning('Returning instance...' ,instance)
  return instance
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
 * @param tableWasJoined If the columns of the given table were joined
 * @returns An array of row objects which relationships are unjoined
 */
export function unjoinRows(schema: Schema, tableName: string, joinedRows: any[], criteria: CriteriaObject, alias: string, tableWasJoined = false): any[]  {
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

  l.lib('Unjoining relationships...', relationshipNames)
  for (let relationshipName of relationshipNames) {
    l.location[1] = '> ' + relationshipName
    l.lib('Unjoining next relationship...', relationshipName)

    if (! (relationshipName in criteria)) {
      l.lib('Relationship is not contained in criteria. Continuing...')
      continue
    }

    let relationship = table.relationships![relationshipName]
    l.lib('Relationship', relationship)

    let relationshipTableName = relationship.otherTable
    let relationshipAlias = alias + relationshipName + '__'

    l.lib('Relationship table name', relationshipTableName)
    l.lib('Relationship alias', relationshipAlias)
    
    l.calling('Fetching all relationship rows. Calling unjoinRows again...')
    let relationshipRows = unjoinRows(schema, relationshipTableName, joinedRows, criteria[relationshipName], relationshipAlias, true)
    l.called('Returning from fetching all relationship rows')
    l.dev('Found relationship rows', relationshipRows)

    relationshipToRows[relationshipName] = relationshipRows
  }

  l.location[1] = ''

  let unjoinedRows: any[] = []
  let idToRow: { [ id: string ]: any } = {}

  l.lib('Unjoining rows...')
  for (let joinedRow of joinedRows) {
    l.lib('Unjoining next row', joinedRow)

    let unjoinedRow = unjoinRow(table, joinedRow, alias, tableWasJoined)

    if (unjoinedRow == undefined) {
      l.lib('Given joined row did not contain any columns of the given given table. Skipping...')
      continue
    }

    l.lib('Unjoined row', unjoinedRow)

    let idColumns = getIdColumns(table)
    let unjoinedRowId = ''
    
    if (idColumns.length > 0) {
      unjoinedRowId += unjoinedRow[idColumns[0]]
    }

    let existingUnjoinedRow = idToRow[unjoinedRowId]

    if (existingUnjoinedRow) {
      l.lib('Not adding unjoined row to result array because we found an already unjoined row representing the same entity in the result array')
    }
    else {
      l.lib('Adding unjoined row to the result array')
      unjoinedRows.push(unjoinedRow)
      l.dev('Adding unjoined row to cache using id', unjoinedRowId)
      idToRow[unjoinedRowId] = unjoinedRow
    }

    let relationshipNames = Object.keys(relationshipToRows)
    l.lib('Adding relationships', relationshipNames)

    for (let relationshipName of relationshipNames) {
      l.location[1] = '> ' + relationshipName

      let relationship = table.relationships![relationshipName]
      
      if (relationship.manyToOne) {
        l.lib('Relationship is many-to-one. Initializing property with null.')
        unjoinedRow[relationshipName] = null
      }
      else if (relationship.oneToMany) {
        l.lib('Relationship is one-to-many. Initializing property with empty array.')
        unjoinedRow[relationshipName] = []
      }

      l.lib('Iterating through every relationshop row...')

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
    }

    l.location[1] = ''
  }

  l.returning('Returning unjoined rows...', unjoinedRows)
  return unjoinedRows
}

export function rowsRepresentSameEntity(table: Table, row1: any, row2: any): boolean {
  if (row1 == undefined || row2 == undefined) {
    return false
  }

  let idColumns = getIdColumns(table)

  if (idColumns.length == 0) {
    return false
  }

  for (let idColumn of idColumns) {
    if (row1[idColumn] === undefined || row1[idColumn] !== row2[idColumn]) {
      return false
    }
  }

  return true
}

export function instancesRepresentSameEntity(table: Table, instance1: any, instance2: any): boolean {
  if (instance1 == undefined || instance2 == undefined) {
    return false
  }
  
  let idColumns = getIdColumns(table)

  if (idColumns.length == 0) {
    return false
  }

  for (let idColumn of idColumns) {
    let idProperty = getPropertyName(table.columns[idColumn])

    if (instance1[idProperty] === undefined || instance1[idProperty] !== instance2[idProperty]) {
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

export function idsOnly(table: Table, row: any): any {
  let idsOnly: any = {}
  
  for (let column of Object.keys(table.columns)) {
    if (isIdColumn(table.columns[column])) {
      idsOnly[column] = row[column]
    }
  }

  return idsOnly
}

export function getColumnsOfTable(row: any, table: Table, alias?: string): any {
  let filteredRow: any = {}

  for (let column of Object.keys(table.columns)) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column
    filteredRow[aliasedColumn] = row[aliasedColumn]
  }

  return filteredRow
}

/**
 * Gets a row consisting of columns of the base table and optionally additional columns which
 * were joined because they refer to the base table through a many-to-one or a one-to-many
 * relationship.
 * 
 * @param table 
 * @param row 
 * @param alias 
 * @returns An object which has only those properties who represent the columns of the given table.
 * If the row did not contain any column of the given table, undefined is returned.
 */
export function unjoinRow(table: Table, row: any, alias?: string, tableWasJoined = false): any {
  let filteredRow: any = undefined
  let everyColumnIsNull = true

  for (let column of Object.keys(table.columns)) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column

    if (aliasedColumn in row) {
      if (filteredRow == undefined) {
        filteredRow = {}
      }

      filteredRow[column] = row[aliasedColumn]

      if (filteredRow[column] !== null) {
        everyColumnIsNull = false
      }
    }
  }

  if (tableWasJoined && everyColumnIsNull) {
    return
  }

  return filteredRow
}

export function allIdsSet(table: Table, row: any): boolean {
  for (let idColumn of getIdColumns(table)) {
    if (row[idColumn] === undefined) {
      return false
    }
  }

  return true
}

export function idsNotSet(table: Table, row: any): string[] {
  let idsNotSet = []

  for (let idColumn of getIdColumns(table)) {
    if (row[idColumn] === undefined) {
      idsNotSet.push(idColumn)
    }
  }

  return idsNotSet
}

export interface RelationshipsToLoad {
  [ relationshipPath: string ]: RelationshipToLoad
}

export interface RelationshipToLoad {
  tableName: string
  relationshipName: string
  relationshipCriteria: CriteriaObject
  rows: any[]
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