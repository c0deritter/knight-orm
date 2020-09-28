import { ReadCriteria } from 'mega-nice-criteria'
import { getIdColumns, isIdColumn, Schema, Table } from './Schema'

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
  // console.debug('ENTERING instanceToRow...')
  // console.debug('tableName', tableName)
  // console.debug('instance', instance)
  // console.debug('alreadyConverted', alreadyConverted.instancesAndRows)

  let row = alreadyConverted.getRow(instance)
  if (row != undefined) {
    // console.debug('Instance was already converted. Returning it...')
    return row
  }

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  row = table.instanceToRow(instance)
  // console.debug('row', row)

  alreadyConverted.add(instance, row)

  for (let relationshipName of Object.keys(table.relationships)) {
    // console.debug('relationshipName', relationshipName)

    if (typeof instance[relationshipName] == 'object' && instance[relationshipName] !== null) {
      let relationship = table.relationships[relationshipName]

      if (relationship.manyToOne || relationship.oneToOne != undefined) {
        // console.debug('Relationship is many-to-one or one-to-one. Going into recursion...')
        row[relationshipName] = instanceToRow(schema, relationship.otherTable, instance[relationshipName], alreadyConverted)
        // console.debug('Coming back from recursion...')
      }
      else if (instance[relationshipName] instanceof Array) {
        // console.debug('Relationship is one-to-many')

        for (let relationshipInstance of instance[relationshipName]) {
          // console.debug('relationshipInstance', relationshipInstance)
          // console.debug('Going into recursion...')
          let relationshipRow = instanceToRow(schema, relationship.otherTable, relationshipInstance, alreadyConverted)
          // console.debug('Coming back from recursion...')

          if (row[relationshipName] == undefined) {
            row[relationshipName] = []
          }

          row[relationshipName].push(relationshipRow)
        }        
      }
    }
    else if (instance[relationshipName] !== undefined) {
      // console.debug('Relationship is not an object and not undefined')
      row[relationshipName] = instance[relationshipName]
    }
    else {
      // console.debug('Relationship does not exist on this instance. Continuing...')
    }
  }

  // console.debug('Returning row...', row)
  return row
}

export function rowToInstance(schema: Schema, tableName: string, row: any, alreadyConverted: AlreadyConverted = new AlreadyConverted): any {
  // console.debug('ENTERING rowToInstance...')
  // console.debug('tableName', tableName)
  // console.debug('instance', instance)
  // console.debug('alreadyConverted', alreadyConverted.instancesAndRows)

  let instance = alreadyConverted.getInstance(row)
  if (instance != undefined) {
    // console.debug('Row was already converted. Returning it...')
    return instance
  }

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  instance = table.rowToInstance(row)
  // console.debug('instance', instance)

  alreadyConverted.add(instance, row)

  for (let relationshipName of Object.keys(table.relationships)) {
    // console.debug('relationshipName', relationshipName)

    if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
      let relationship = table.relationships[relationshipName]

      if (relationship.manyToOne || relationship.oneToOne != undefined) {
        // console.debug('Relationship is many-to-one or one-to-one. Going into recursion...')
        instance[relationshipName] = rowToInstance(schema, table.relationships[relationshipName].otherTable, row[relationshipName], alreadyConverted)
        // console.debug('Coming back from recursion...')
      }
      else if (row[relationshipName] instanceof Array) {
        // console.debug('Relationship is one-to-many')

        for (let relationshipRow of row[relationshipName]) {
          // console.debug('relationshipRow', relationshipRow)
          // console.debug('Going into recursion...')
          let relationshipInstance = rowToInstance(schema, table.relationships[relationshipName].otherTable, relationshipRow, alreadyConverted)
          // console.debug('Coming back from recursion...')

          if (instance[relationshipName] == undefined) {
            instance[relationshipName] = []
          }

          instance[relationshipName].push(relationshipInstance)
        }        
      }
    }
    else if (row[relationshipName] !== undefined) {
      // console.debug('Relationship is not an object and not undefined')
      row[relationshipName] = instance[relationshipName]
    }
    else {
      // console.debug('Relationship does not exist on this instance. Continuing...')
    }

  }

  return instance
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

  let relationshipNames = Object.keys(table.relationships)
  let rowsOrInstances: any[] = []

  // console.debug('relationshipNames', relationshipNames)

  // console.debug('Iterating over all rows...')
  for (let joinedRow of joinedRows) {
    // console.debug('row', row)

    if (! isRowRelevant(joinedRow, rowFilter)) {
      // console.debug('Row is not relevant. Continuing...')
      continue
    }

    let unaliasedRow = getCellsBelongingToTableAndRemoveAlias(table, joinedRow, alias)
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

    let filteredRow = getCellsBelongingToTable(table, joinedRow, alias)
    // console.debug('filteredRow', filteredRow)

    // console.debug('Iterating over all relationships...')
    for (let relationshipName of relationshipNames) {
      // console.debug('relationshipName', relationshipName)
      
      let relationship = table.relationships[relationshipName]
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