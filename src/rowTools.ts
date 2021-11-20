import { Criteria, CriteriaObject, summarizeCriteria } from 'knight-criteria'
import { Log } from 'knight-log'
import { getNotGeneratedPrimaryKeyColumns } from '.'
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