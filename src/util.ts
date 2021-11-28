import { Log } from 'knight-log'
import { rowsRepresentSameEntity } from './rowTools'
import { Schema } from './Schema'

let l = new Log('util.tsx')

let storedRowsLog = l.cls('StoredRows')

export class StoredRows {
  schema: Schema
  rows: {
    tableName: string,
    originalRow: any,
    storedRow?: any,
    afterSettingResultHandlers: ((result: any) => Promise<void>)[]
  }[] = []

  constructor(schema: Schema) {
    this.schema = schema
  }

  add(tableName: string, originalRow: any, storedRow?: any) {
    if (! this.containsOriginalRow(tableName, originalRow)) {
      this.rows.push({
        tableName: tableName,
        originalRow: originalRow,
        storedRow: storedRow,
        afterSettingResultHandlers: []
      })
    }
  }

  remove(row: any) {
    let index = -1

    for (let i = 0; i < this.rows.length; i++) {
      if (this.rows[i].originalRow === row) {
        index = i
        break
      }
    }

    if (index > -1) {
      this.rows.splice(index, 1)
    }
  }

  async setStoredRow(originalRow: any, storedRow: any): Promise<void> {
    let l = storedRowsLog.mt('setResult')
    l.param('originalRow', originalRow)
    l.param('storedRow', storedRow)

    l.dev('Trying to determine the fiddled row object which must exist at this point in time')

    let existingRow = undefined
    for (let row of this.rows) {
      if (row.originalRow === originalRow) {
        existingRow = row
      }
    }

    if (existingRow == undefined) {
      throw new Error('Could not set result because the row object was not already fiddled with')
    }

    existingRow.storedRow = storedRow
    l.dev('Setting given result on the existing fiddled row', existingRow)

    if (existingRow.afterSettingResultHandlers.length > 0) {
      l.lib('Calling every registered handler after the result was set')
  
      for (let fn of existingRow.afterSettingResultHandlers) {
        l.calling('Calling next result handler...')
        await fn(storedRow)
        l.called('Called result handler')
      }
    }
    else {
      l.lib('There are no handler to be called after the result was set')
    }

    l.returning('Finished setting result. Returning...')
  }

  addAfterStoredRowHandler(row: any, handler: (result: any) => Promise<void>) {
    let existingRow = undefined
    for (let row of this.rows) {
      if (row.originalRow === row) {
        existingRow = row
      }
    }

    if (existingRow == undefined) {
      throw new Error('Could not addAfterStoredRowHandler because the row object was not already fiddled with')
    }

    existingRow.afterSettingResultHandlers.push(handler)
  }

  containsTableName(tableName: string): boolean {
    for (let row of this.rows) {
      if (row.tableName === tableName) {
        return true
      }
    }
    return false
  }

  containsOriginalRow(tableName: string, originalRow: any): boolean {
    let table = this.schema[tableName]

    if (table == undefined) {
      throw new Error('Table not contained in schema: ' + tableName)
    }

    for (let row of this.rows) {
      if (row.originalRow === originalRow) {
        return true
      }

      if (rowsRepresentSameEntity(table, originalRow, row.originalRow)) {
        return true
      }
    }

    return false
  }

  getStoredRowByOriginalRow(tableName: string, originalRow: any): any | undefined {
    let table = this.schema[tableName]

    if (table == undefined) {
      throw new Error('Table not contained in schema: ' + tableName)
    }

    for (let row of this.rows) {
      if (row.originalRow === originalRow) {
        return row.storedRow
      }

      if (rowsRepresentSameEntity(table, originalRow, row.originalRow)) {
        return row.storedRow
      }
    }
  }

  getStoredRowByTableNameAndId(tableName: string, idColumnName: string, idColumnValue: any): any | undefined {
    for (let row of this.rows) {
      if (row.tableName == tableName && row.storedRow != undefined) {
        if (row.storedRow[idColumnName] == idColumnValue) {
          return row.storedRow
        }
      }
    }
  }
}

