import { Log } from 'knight-log'
import { Schema } from './Schema'

let log = new Log('util.tsx')
let storedRowsLog = log.cls('StoredRows')

export interface RowEntry {
  stored: boolean,
  row: any,
  afterSettingResultHandlers: ((result: any) => Promise<void>)[]
}

export class StoredRows {
  schema: Schema
  rowEntries: RowEntry[] = []

  constructor(schema: Schema) {
    this.schema = schema
  }

  setRowAboutToBeStored(row: any) {
    if (! this.containsRow(row)) {
      this.rowEntries.push({
        stored: false,
        row: row,
        afterSettingResultHandlers: []
      } as RowEntry)
    }
  }

  isRowAboutToBeStored(row: any): boolean {
    let rowEntry = this.getRowEntry(row)
    return rowEntry != undefined && ! rowEntry.stored
  }

  async setRowStored(row: any): Promise<void> {
    let l = storedRowsLog.mt('setRowStored')
    let rowEntry = this.getRowEntry(row)

    if (rowEntry == undefined) {
      throw new Error('Could not set result because the row object was not already fiddled with')
    }

    rowEntry.stored = true

    if (rowEntry.afterSettingResultHandlers.length > 0) {
      l.lib('Calling every registered handler after the result was set')
  
      for (let fn of rowEntry.afterSettingResultHandlers) {
        l.calling('Calling next result handler...')
        await fn(rowEntry.row)
        l.called('Called result handler')
      }
    }
    else {
      l.lib('There are no handler to be called after the result was set')
    }

    l.returning('Finished setting result. Returning...')
  }

  isRowStored(row: any): boolean {
    let rowEntry = this.getRowEntry(row)
    return rowEntry != undefined && rowEntry.stored
  }

  getRowEntry(row: any): RowEntry|undefined {
    for (let rowEntry of this.rowEntries) {
      if (rowEntry.row === row) {
        return rowEntry
      }
    }
  }

  containsRow(row: any): boolean {
    return this.getRowEntry(row) != undefined
  }

  remove(row: any) {
    let index = -1

    for (let i = 0; i < this.rowEntries.length; i++) {
      if (this.rowEntries[i].row === row) {
        index = i
        break
      }
    }

    if (index > -1) {
      this.rowEntries.splice(index, 1)
    }
  }

  addAfterStoredRowHandler(row: any, handler: (result: any) => Promise<void>) {
    let rowEntry = this.getRowEntry(row)

    if (rowEntry == undefined) {
      throw new Error('Could not addAfterStoredRowHandler because the row object was not already fiddled with')
    }

    rowEntry.afterSettingResultHandlers.push(handler)
  }
}

