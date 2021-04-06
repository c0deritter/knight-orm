import { ReadCriteria } from 'knight-criteria'
import Log from 'knight-log'
import { criteriaDoesNotContainColumns } from './criteriaTools'
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
    l.user('Instance was already converted. Returning it...', row)
    return row
  }

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  row = table.instanceToRow(instance)
  l.var('row', row)

  alreadyConverted.add(instance, row)

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.var('relationshipName', relationshipName)
  
      if (typeof instance[relationshipName] == 'object' && instance[relationshipName] !== null) {
        let relationship = table.relationships[relationshipName]
  
        if (relationship.manyToOne) {
          l.user('Relationship is many-to-one. Going into recursion...')
          row[relationshipName] = instanceToRow(schema, relationship.otherTable, instance[relationshipName], alreadyConverted)
          l.returning('Returning from recursion...')
        }
        else if (instance[relationshipName] instanceof Array) {
          l.user('Relationship is one-to-many')
  
          for (let relationshipInstance of instance[relationshipName]) {
            l.var('relationshipInstance', relationshipInstance)
            l.user('Going into recursion...')
            let relationshipRow = instanceToRow(schema, relationship.otherTable, relationshipInstance, alreadyConverted)
            l.returning('Returning from recursion...')
  
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
        l.user('Relationship is not an object and not undefined')
        row[relationshipName] = instance[relationshipName]
      }
      else {
        l.user('Relationship does not exist on this instance. Continuing...')
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
    l.user('Row was already converted. Returning it...')
    return instance
  }

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  instance = table.rowToInstance(row)
  l.var('instance', instance)

  alreadyConverted.add(instance, row)

  l.user('Converting relationships...')

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.location.push(' ' + relationshipName)
      l.dev('Converting next relationship...', relationshipName)
      l.location.push('.' + relationshipName)
      l.var('row', row)
  
      if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
        let relationship = table.relationships[relationshipName]
  
        if (relationship.manyToOne) {
          l.user('Converting many-to-one. Going into recursion...')
          let relationshipInstance = rowToInstance(schema, table.relationships[relationshipName].otherTable, row[relationshipName], alreadyConverted)
          l.returning('Returning from recursion...')
          
          l.user('Setting converted relationship instance...', relationshipInstance)
          l.user('...on row', row)
          instance[relationshipName] = relationshipInstance
        }
        else if (row[relationshipName] instanceof Array) {
          l.user('Relationship is one-to-many. Converting every relationship row...')
  
          for (let relationshipRow of row[relationshipName]) {
            l.user('Converting next relationship row...', relationshipRow)
            l.var('row', row)
            l.user('Going into recursion...')
            let relationshipInstance = rowToInstance(schema, table.relationships[relationshipName].otherTable, relationshipRow, alreadyConverted)
            l.returning('Returning from recursion...')
  
            if (instance[relationshipName] == undefined) {
              instance[relationshipName] = []
            }
  
            l.user('Adding converted relationship instance to relationship array...', relationshipInstance)
            l.user('...on row', row)
            instance[relationshipName].push(relationshipInstance)
          }        
        }
      }
      else if (row[relationshipName] !== undefined) {
        l.user('Relationship is not an object but also not undefined. Setting given value without converting...')
        row[relationshipName] = instance[relationshipName]
      }
      else {
        l.user('Relationship is not set. Continuing...')
      }

      l.location.pop()
    }
  }

  l.returning('Returning instance...' ,instance)
  return instance
}

export function unjoinRows(schema: Schema, tableName: string, joinedRows: any[], criteria: ReadCriteria, toInstances: boolean = false, alias?: string, alreadyUnjoined: { tableName: string, rowOrInstance: any }[] = []): any[]  {
  let l = log.fn('unjoinRows')

  let rootRows = alias == undefined
  alias = alias != undefined ? alias : tableName + '__'

  l.location = [ alias, '' ]

  l.param('joinedRows', joinedRows)
  l.param('criteria', criteria)
  l.param('tableName', tableName)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let relationshipNames = table.relationships != undefined ? Object.keys(table.relationships) : []
  l.var('relationshipNames', relationshipNames)

  let rowsOrInstances: any[] = []

  l.user('Unjoining rows...')
  for (let joinedRow of joinedRows) {
    l.user('Unjoining next row', joinedRow)

    let unaliasedRow = getCellsBelongingToTableAndRemoveAlias(table, joinedRow, alias)
    l.var('unaliasedRow', unaliasedRow)

    // if every column is null then there was no row in the first place
    let everyColumnIsNull = true
    for (let columnName of Object.keys(table.columns)) {
      // we use a soft comparison to null here because if it is undefined it is as good as null
      // though that should not really be possible
      if (unaliasedRow[columnName] != null) {
        everyColumnIsNull = false
        break
      }
    }

    if (! rootRows && everyColumnIsNull) {
      l.dev('Every column is null and it is not the root row thus there is no row. Continuing...')
      continue
    }

    let rowOrInstance = toInstances ? table.rowToInstance(unaliasedRow) : unaliasedRow
    l.var('rowOrInstance', rowOrInstance)

    let alreadyUnjoinedRowOrInstance: any = undefined

    if (! rootRows || rootRows && ! everyColumnIsNull) {
      l.user('Determining already unjoined row or instance...')
      for (let tableAndRowOrInstance of alreadyUnjoined) {
        if (tableAndRowOrInstance.tableName != tableName) {
          continue
        }
  
        if (! toInstances && rowsRepresentSameEntity(table, rowOrInstance, tableAndRowOrInstance.rowOrInstance)) {
          alreadyUnjoinedRowOrInstance = tableAndRowOrInstance.rowOrInstance
          break
        }
        else if (toInstances && instancesRepresentSameEntity(table, rowOrInstance, tableAndRowOrInstance.rowOrInstance)) {
          alreadyUnjoinedRowOrInstance = tableAndRowOrInstance.rowOrInstance
          break
        }
      }  
    }

    l.var('alreadyUnjoinedRowOrInstance', alreadyUnjoinedRowOrInstance)

    if (alreadyUnjoinedRowOrInstance != undefined) {
      if (rowsOrInstances.indexOf(alreadyUnjoinedRowOrInstance) == -1) {
        l.user('Adding already converted row or instance to the result array...')
        rowsOrInstances.push(alreadyUnjoinedRowOrInstance)
      }

      rowOrInstance = alreadyUnjoinedRowOrInstance
    }
    else {
      l.user('Adding just converted row or instance to the result array...')
      rowsOrInstances.push(rowOrInstance)
      l.user('Adding just converted row or instance to list if already unjoined rows or instances...')
      alreadyUnjoined.push({ tableName: tableName, rowOrInstance: rowOrInstance })
    }

    l.user('Unjoining relationships...')
    for (let relationshipName of relationshipNames) {
      l.location[1] = ' > ' + relationshipName
      l.var('Unjoining next relationship...', relationshipName)

      if (! (relationshipName in criteria)) {
        l.user('Relationship is not contained in criteria. Continuing...')
        continue
      }

      let relationship = table.relationships![relationshipName]
      l.var('relationship', relationship)

      let relationshipTableName = relationship.otherTable
      let relationshipAlias = alias != undefined ? alias + relationshipName + '__' : relationshipName + '__'

      l.var('relationshipTableName', relationshipTableName)
      l.var('relationshipAlias', relationshipAlias)
      
      l.user('Determining relationship. Going into recursion...')
      let relationshipRowOrInstances = unjoinRows(schema, relationshipTableName, [ joinedRow ], criteria[relationshipName], toInstances, relationshipAlias, alreadyUnjoined)
      l.returning('Returning from recursion...', relationshipRowOrInstances)

      if (relationship.oneToMany) {
        if (rowOrInstance[relationshipName] == undefined) {
          l.user('Setting one-to-many rows or instances array...', relationshipRowOrInstances)
          rowOrInstance[relationshipName] = relationshipRowOrInstances
        }
        else if (relationshipRowOrInstances[0] != undefined && rowOrInstance[relationshipName].indexOf(relationshipRowOrInstances[0]) == -1) {
          l.user('Adding relationship row or instance to array...', relationshipRowOrInstances[0])
          rowOrInstance[relationshipName].push(relationshipRowOrInstances[0])
        }
        else if (relationshipRowOrInstances[0] == undefined) {
          l.user('One-to-many relationship row or instance is empty in this row. Not adding anything...')
        }
        else {
          l.user('One-to-many relationship row or instance was already added to array. Not adding again...')
        }
      }
      else if (relationship.manyToOne) {
        if (rowOrInstance[relationshipName] == undefined) {
          l.user('Setting many-to-one row or instance...')
          rowOrInstance[relationshipName] = relationshipRowOrInstances.length == 1 ? relationshipRowOrInstances[0] : null  
        }
        else {
          l.user('Many-to-one relationship row or instance was already set. Not setting again...')
        }
      }
    }

    l.location[1] = ''
  }

  l.returning('Returning rowsOrInstances...', rowsOrInstances)
  return rowsOrInstances
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

export function getCellsBelongingToTable(table: Table, row: any, alias?: string): any {
  let relevantCells: any = {}

  for (let column of Object.keys(table.columns)) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column
    relevantCells[aliasedColumn] = row[aliasedColumn]
  }

  return relevantCells
}

export function getCellsBelongingToTableAndRemoveAlias(table: Table, row: any, alias?: string): any {
  let relevantCells: any = {}

  for (let column of Object.keys(table.columns)) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column : column
    relevantCells[column] = row[aliasedColumn]
  }

  return relevantCells
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
  relationshipCriteria: ReadCriteria
  rows: any[]
}

export function determineRelationshipsToLoad(schema: Schema, tableName: string, rows: any[], criteria: ReadCriteria, relationshipPath: string = '', relationshipsToLoad: RelationshipsToLoad = {}): RelationshipsToLoad {
  let l = log.fn('determineRelationshipsToLoad')
  l.location = [ tableName ]
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

  l.user('Iterating through all given rows determining relationships to load...')

  for (let row of rows) {
    l.user('Determining relationships to load for row', row)
    l.user('Iterating through all relationships...')

    for (let relationshipName of Object.keys(table.relationships)) {
      l.var('relationshipName', relationshipName)

      let relationshipCriteria = criteria[relationshipName]
      l.var('relationshipCriteria', relationshipCriteria)

      if (relationshipCriteria == undefined) {
        l.user('There are no criteria for this relationship. Continuing...')
        continue
      }

      let relationshipValue = row[relationshipName]
      l.var('relationshipValue', relationshipValue)

      let relationship = table.relationships ? table.relationships[relationshipName] : undefined
      if (relationship == undefined) {
        throw new Error(`Relationship '${relationshipName}' not contained table '${tableName}'`)
      }

      let otherTable = schema[relationship.otherTable]
      if (otherTable == undefined) {
        throw new Error('Table not contained in schema: ' + relationship.otherTable)
      }

      let subRelationshipPath = relationshipPath + '.' + relationshipName
      l.var('subRelationshipPath', subRelationshipPath)
      
      if (relationshipCriteria['@filterGlobally'] === true || criteriaDoesNotContainColumns(otherTable, relationshipCriteria)) {
        if (relationship.manyToOne && relationshipValue != undefined || relationship.oneToMany && relationshipValue instanceof Array && relationshipValue.length > 0) {
          l.user('Relationship was joined and loaded. Going into recursion...')

          determineRelationshipsToLoad(schema, 
            relationship.otherTable, 
            relationship.manyToOne ? [ row[relationshipName] ] : row[relationshipName], 
            relationshipCriteria, 
            subRelationshipPath,
            relationshipsToLoad)

          l.user('Returning from recursion...')
        }
        else {
          l.user('Relationship was joined but it did not find anything. Continuing...')
        }
      }
      else {
        l.user('Relationship was not joined. Adding it to relationshipsToLoad...')

        if (relationshipsToLoad[subRelationshipPath] == undefined) {
          relationshipsToLoad[subRelationshipPath] = {
            tableName: tableName,
            relationshipName: relationshipName,
            relationshipCriteria: relationshipCriteria,
            rows: []
          }
        }

        relationshipsToLoad[subRelationshipPath].rows.push(row)
      }
    }
  }

  l.returning('Returning relationshipsToLoad...', relationshipsToLoad)
  return relationshipsToLoad
}