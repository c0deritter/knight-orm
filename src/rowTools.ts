import { CriteriaObject } from 'knight-criteria'
import { Log } from 'knight-log'
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
    l.libUser('Instance was already converted. Returning it...', row)
    return row
  }

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  row = table.instanceToRow(instance)
  l.libUser('row', row)

  alreadyConverted.add(instance, row)

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.libUser('relationshipName', relationshipName)
  
      if (typeof instance[relationshipName] == 'object' && instance[relationshipName] !== null) {
        let relationship = table.relationships[relationshipName]
  
        if (relationship.manyToOne) {
          l.libUser('Relationship is many-to-one. Going into recursion...')
          row[relationshipName] = instanceToRow(schema, relationship.otherTable, instance[relationshipName], alreadyConverted)
          l.returning('Returning from recursion...')
        }
        else if (instance[relationshipName] instanceof Array) {
          l.libUser('Relationship is one-to-many')
  
          for (let relationshipInstance of instance[relationshipName]) {
            l.libUser('relationshipInstance', relationshipInstance)
            l.libUser('Going into recursion...')
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
        l.libUser('Relationship is not an object and not undefined')
        row[relationshipName] = instance[relationshipName]
      }
      else {
        l.libUser('Relationship does not exist on this instance. Continuing...')
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
    l.libUser('Row was already converted. Returning it...')
    return instance
  }

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  instance = table.rowToInstance(row)
  l.libUser('instance', instance)

  alreadyConverted.add(instance, row)

  l.libUser('Converting relationships...')

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.location.push(' ' + relationshipName)
      l.dev('Converting next relationship...', relationshipName)
      l.location.push('.' + relationshipName)
      l.libUser('row', row)
  
      if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
        let relationship = table.relationships[relationshipName]
  
        if (relationship.manyToOne) {
          l.libUser('Converting many-to-one. Going into recursion...')
          let relationshipInstance = rowToInstance(schema, table.relationships[relationshipName].otherTable, row[relationshipName], alreadyConverted)
          l.returning('Returning from recursion...')
          
          l.libUser('Setting converted relationship instance...', relationshipInstance)
          l.libUser('...on row', row)
          instance[relationshipName] = relationshipInstance
        }
        else if (row[relationshipName] instanceof Array) {
          l.libUser('Relationship is one-to-many. Converting every relationship row...')
  
          for (let relationshipRow of row[relationshipName]) {
            l.libUser('Converting next relationship row...', relationshipRow)
            l.libUser('row', row)
            l.libUser('Going into recursion...')
            let relationshipInstance = rowToInstance(schema, table.relationships[relationshipName].otherTable, relationshipRow, alreadyConverted)
            l.returning('Returning from recursion...')
  
            if (instance[relationshipName] == undefined) {
              instance[relationshipName] = []
            }
  
            l.libUser('Adding converted relationship instance to relationship array...', relationshipInstance)
            l.libUser('...on row', row)
            instance[relationshipName].push(relationshipInstance)
          }        
        }
      }
      else if (row[relationshipName] !== undefined) {
        l.libUser('Relationship is not an object but also not undefined. Setting given value without converting...')
        row[relationshipName] = instance[relationshipName]
      }
      else {
        l.libUser('Relationship is not set. Continuing...')
      }

      l.location.pop()
    }
  }

  l.returning('Returning instance...' ,instance)
  return instance
}

export function unjoinRows(schema: Schema, tableName: string, joinedRows: any[], criteria: CriteriaObject, toInstances: boolean = false, alias?: string, alreadyUnjoined: { tableName: string, rowOrInstance: any }[] = []): any[]  {
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
  l.libUser('relationshipNames', relationshipNames)

  let rowsOrInstances: any[] = []

  l.libUser('Unjoining rows...')
  for (let joinedRow of joinedRows) {
    l.libUser('Unjoining next row', joinedRow)

    let unaliasedRow = getCellsBelongingToTableAndRemoveAlias(table, joinedRow, alias)
    l.libUser('unaliasedRow', unaliasedRow)

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
    l.libUser('rowOrInstance', rowOrInstance)

    let alreadyUnjoinedRowOrInstance: any = undefined

    if (! rootRows || rootRows && ! everyColumnIsNull) {
      l.libUser('Determining already unjoined row or instance...')
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

    l.libUser('alreadyUnjoinedRowOrInstance', alreadyUnjoinedRowOrInstance)

    if (alreadyUnjoinedRowOrInstance != undefined) {
      if (rowsOrInstances.indexOf(alreadyUnjoinedRowOrInstance) == -1) {
        l.libUser('Adding already converted row or instance to the result array...')
        rowsOrInstances.push(alreadyUnjoinedRowOrInstance)
      }

      rowOrInstance = alreadyUnjoinedRowOrInstance
    }
    else {
      l.libUser('Adding just converted row or instance to the result array...')
      rowsOrInstances.push(rowOrInstance)
      l.libUser('Adding just converted row or instance to list if already unjoined rows or instances...')
      alreadyUnjoined.push({ tableName: tableName, rowOrInstance: rowOrInstance })
    }

    l.libUser('Unjoining relationships...')
    for (let relationshipName of relationshipNames) {
      l.location[1] = ' > ' + relationshipName
      l.libUser('Unjoining next relationship...', relationshipName)

      if (! (relationshipName in criteria)) {
        l.libUser('Relationship is not contained in criteria. Continuing...')
        continue
      }

      let relationship = table.relationships![relationshipName]
      l.libUser('relationship', relationship)

      let relationshipTableName = relationship.otherTable
      let relationshipAlias = alias != undefined ? alias + relationshipName + '__' : relationshipName + '__'

      l.libUser('relationshipTableName', relationshipTableName)
      l.libUser('relationshipAlias', relationshipAlias)
      
      l.libUser('Determining relationship. Going into recursion...')
      let relationshipRowOrInstances = unjoinRows(schema, relationshipTableName, [ joinedRow ], criteria[relationshipName], toInstances, relationshipAlias, alreadyUnjoined)
      l.returning('Returning from recursion...', relationshipRowOrInstances)

      if (relationship.oneToMany) {
        if (rowOrInstance[relationshipName] == undefined) {
          l.libUser('Setting one-to-many rows or instances array...', relationshipRowOrInstances)
          rowOrInstance[relationshipName] = relationshipRowOrInstances
        }
        else if (relationshipRowOrInstances[0] != undefined && rowOrInstance[relationshipName].indexOf(relationshipRowOrInstances[0]) == -1) {
          l.libUser('Adding relationship row or instance to array...', relationshipRowOrInstances[0])
          rowOrInstance[relationshipName].push(relationshipRowOrInstances[0])
        }
        else if (relationshipRowOrInstances[0] == undefined) {
          l.libUser('One-to-many relationship row or instance is empty in this row. Not adding anything...')
        }
        else {
          l.libUser('One-to-many relationship row or instance was already added to array. Not adding again...')
        }
      }
      else if (relationship.manyToOne) {
        if (rowOrInstance[relationshipName] == undefined) {
          l.libUser('Setting many-to-one row or instance...')
          rowOrInstance[relationshipName] = relationshipRowOrInstances.length == 1 ? relationshipRowOrInstances[0] : null  
        }
        else {
          l.libUser('Many-to-one relationship row or instance was already set. Not setting again...')
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
  relationshipCriteria: CriteriaObject
  rows: any[]
}

export function determineRelationshipsToLoad(schema: Schema, tableName: string, rows: any[], criteria: CriteriaObject, relationshipPath: string = '', relationshipsToLoad: RelationshipsToLoad = {}): RelationshipsToLoad {
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

  l.libUser('Iterating through all given rows determining relationships to load...')

  for (let row of rows) {
    l.libUser('Determining relationships to load for row', row)
    l.libUser('Iterating through all relationships...')

    for (let relationshipName of Object.keys(table.relationships)) {
      l.libUser('relationshipName', relationshipName)

      let relationshipCriteria = criteria[relationshipName]
      l.libUser('relationshipCriteria', relationshipCriteria)

      if (relationshipCriteria == undefined) {
        l.libUser('There are no criteria for this relationship. Continuing...')
        continue
      }

      let relationshipValue = row[relationshipName]
      l.libUser('relationshipValue', relationshipValue)

      let relationship = table.relationships ? table.relationships[relationshipName] : undefined
      if (relationship == undefined) {
        throw new Error(`Relationship '${relationshipName}' not contained table '${tableName}'`)
      }

      let otherTable = schema[relationship.otherTable]
      if (otherTable == undefined) {
        throw new Error('Table not contained in schema: ' + relationship.otherTable)
      }

      let subRelationshipPath = relationshipPath + '.' + relationshipName
      l.libUser('subRelationshipPath', subRelationshipPath)
      
      if (relationshipCriteria['@filterGlobally'] === true || criteriaDoesNotContainColumns(otherTable, relationshipCriteria)) {
        if (relationship.manyToOne && relationshipValue != undefined || relationship.oneToMany && relationshipValue instanceof Array && relationshipValue.length > 0) {
          l.libUser('Relationship was joined and loaded. Going into recursion...')

          determineRelationshipsToLoad(schema, 
            relationship.otherTable, 
            relationship.manyToOne ? [ row[relationshipName] ] : row[relationshipName], 
            relationshipCriteria, 
            subRelationshipPath,
            relationshipsToLoad)

          l.libUser('Returning from recursion...')
        }
        else {
          l.libUser('Relationship was joined but it did not find anything. Continuing...')
        }
      }
      else {
        l.libUser('Relationship was not joined. Adding it to relationshipsToLoad...')

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