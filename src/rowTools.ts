import { ReadCriteria } from 'mega-nice-criteria'
import Log from 'mega-nice-log'
import { getIdColumns, isIdColumn, Schema, Table, getPropertyName } from './Schema'

let log = new Log('mega-nice-sql-orm/rowTools.ts')

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
  l.debug('parameter: tableName', tableName)
  l.debug('parameter: instance', instance)
  l.debug('parameter: alreadyConverted', alreadyConverted.instancesAndRows)

  let row = alreadyConverted.getRow(instance)
  if (row != undefined) {
    l.debug('Instance was already converted. Returning it...', row)
    return row
  }

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  row = table.instanceToRow(instance)
  l.debug('row', row)

  alreadyConverted.add(instance, row)

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.debug('relationshipName', relationshipName)
  
      if (typeof instance[relationshipName] == 'object' && instance[relationshipName] !== null) {
        let relationship = table.relationships[relationshipName]
  
        if (relationship.manyToOne) {
          l.debug('Relationship is many-to-one. Going into recursion...')
          row[relationshipName] = instanceToRow(schema, relationship.otherTable, instance[relationshipName], alreadyConverted)
          l.debug('Coming back from recursion...')
        }
        else if (instance[relationshipName] instanceof Array) {
          l.debug('Relationship is one-to-many')
  
          for (let relationshipInstance of instance[relationshipName]) {
            l.debug('relationshipInstance', relationshipInstance)
            l.debug('Going into recursion...')
            let relationshipRow = instanceToRow(schema, relationship.otherTable, relationshipInstance, alreadyConverted)
            l.debug('Coming back from recursion...')
  
            if (row[relationshipName] == undefined) {
              row[relationshipName] = []
            }
  
            row[relationshipName].push(relationshipRow)
          }        
        }
      }
      else if (instance[relationshipName] !== undefined) {
        l.debug('Relationship is not an object and not undefined')
        row[relationshipName] = instance[relationshipName]
      }
      else {
        l.debug('Relationship does not exist on this instance. Continuing...')
      }
    }  
  }

  l.debug('Returning row...', row)
  return row
}

export function rowToInstance(schema: Schema, tableName: string, row: any, alreadyConverted: AlreadyConverted = new AlreadyConverted): any {
  let l = log.fn('rowToInstance')
  l.debug('parameter: tableName', tableName)
  l.debug('parameter: row', row)
  l.debug('parameter: alreadyConverted', alreadyConverted.instancesAndRows)

  let instance = alreadyConverted.getInstance(row)
  if (instance != undefined) {
    l.debug('Row was already converted. Returning it...')
    return instance
  }

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  instance = table.rowToInstance(row)
  l.debug('instance', instance)

  alreadyConverted.add(instance, row)

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.debug('relationshipName', relationshipName)
  
      if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
        let relationship = table.relationships[relationshipName]
  
        if (relationship.manyToOne) {
          l.debug('Relationship is many-to-one or one-to-one. Going into recursion...')
          instance[relationshipName] = rowToInstance(schema, table.relationships[relationshipName].otherTable, row[relationshipName], alreadyConverted)
          l.debug('Coming back from recursion...')
        }
        else if (row[relationshipName] instanceof Array) {
          l.debug('Relationship is one-to-many')
  
          for (let relationshipRow of row[relationshipName]) {
            l.debug('relationshipRow', relationshipRow)
            l.debug('Going into recursion...')
            let relationshipInstance = rowToInstance(schema, table.relationships[relationshipName].otherTable, relationshipRow, alreadyConverted)
            l.debug('Coming back from recursion...')
  
            if (instance[relationshipName] == undefined) {
              instance[relationshipName] = []
            }
  
            instance[relationshipName].push(relationshipInstance)
          }        
        }
      }
      else if (row[relationshipName] !== undefined) {
        l.debug('Relationship is not an object and not undefined')
        row[relationshipName] = instance[relationshipName]
      }
      else {
        l.debug('Relationship does not exist on this instance. Continuing...')
      }
    }      
  }

  return instance
}

export function unjoinRows(schema: Schema, tableName: string, joinedRows: any[], criteria: ReadCriteria, toInstances: boolean = false, alias?: string): any[]  {
  let l = log.fn('unjoinRows')
  l.debug('parameter: joinedRows', joinedRows)
  l.debug('parameter: criteria', criteria)
  l.debug('parameter: tableName', tableName)
  l.debug('parameter: alias', alias)

  let alreadyUnjoined: { tableName: string, rowOrInstance: any }[] = []
  let rootRows = alias == undefined
  alias = alias != undefined ? alias : tableName + '__'

  l.debug('rootRows', rootRows)
  l.debug('alias', alias)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let relationshipNames = table.relationships != undefined ? Object.keys(table.relationships) : []
  l.debug('relationshipNames', relationshipNames)

  let rowsOrInstances: any[] = []

  l.debug('Iterating over all rows...')
  for (let joinedRow of joinedRows) {
    l.debug('joinedRow in context of alias ' + alias, joinedRow)

    let unaliasedRow = getCellsBelongingToTableAndRemoveAlias(table, joinedRow, alias)
    l.debug('unaliasedRow', unaliasedRow)

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
      continue
    }

    let rowOrInstance = toInstances ? table.rowToInstance(unaliasedRow) : unaliasedRow
    l.debug('rowOrInstance', rowOrInstance)

    let alreadyUnjoinedRowOrInstance: any = undefined

    if (! rootRows || rootRows && ! everyColumnIsNull) {
      l.debug('Determining already unjoined row or instance...')
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

    l.debug('alreadyUnjoinedRowOrInstance', alreadyUnjoinedRowOrInstance)

    if (alreadyUnjoinedRowOrInstance != undefined) {
      if (rowsOrInstances.indexOf(alreadyUnjoinedRowOrInstance) == -1) {
        l.debug('Already unjoined row was not contained. Pushing into result array...')
        rowsOrInstances.push(alreadyUnjoinedRowOrInstance)
      }

      rowOrInstance = alreadyUnjoinedRowOrInstance
    }
    else {
      rowsOrInstances.push(rowOrInstance)
      alreadyUnjoined.push({ tableName: tableName, rowOrInstance: rowOrInstance })
    }

    l.debug('Iterating over all relationships...')
    for (let relationshipName of relationshipNames) {
      l.debug('relationshipName', relationshipName)

      if (! (relationshipName in criteria)) {
        l.debug('Relationship is not contained in criteria. Continuing...')
        continue
      }

      let relationship = table.relationships![relationshipName]
      l.debug('relationship', relationship)

      if ((relationship.manyToOne) && rowOrInstance[relationshipName] != undefined) {
        l.debug('Many-to-one relationship was already determined. Continuing...')
        continue
      }

      let relationshipTableName = relationship.otherTable
      let relationshipAlias = alias != undefined ? alias + relationshipName + '__' : relationshipName + '__'

      l.debug('relationshipTableName', relationshipTableName)
      l.debug('relationshipAlias', relationshipAlias)
      
      l.debug('Determining relationship. Going into recursion...')
      let relationshipRowOrInstances = unjoinRows(schema, relationshipTableName, [ joinedRow ], criteria[relationshipName], toInstances, relationshipAlias)
      l.debug('Coming back from recursion...', relationshipRowOrInstances)

      if (relationshipRowOrInstances.length == 1) {
        if (relationship.oneToMany) {
          l.debug('Attaching one-to-many instance...')
          if (rowOrInstance[relationshipName] == undefined) {
            rowOrInstance[relationshipName] = relationshipRowOrInstances
          }
          else {
            rowOrInstance[relationshipName].push(relationshipRowOrInstances[0])
          }
        }
        else if (relationship.manyToOne) {
          l.debug('Attaching many-to-one instance...')
          rowOrInstance[relationshipName] = relationshipRowOrInstances[0]
        }  
      }
      else {
        l.debug('Not attaching anything...', relationship)
      }
    }
  }

  l.debug('Returning rowsOrInstances...', rowsOrInstances)
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