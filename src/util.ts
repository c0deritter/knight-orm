import { Log } from 'knight-log'
import { rowsRepresentSameEntity } from './rowTools'
import { Schema } from './Schema'

let l = new Log('util.tsx')

let fiddledRowsLog = l.cls('FiddledRows')

export class FiddledRows {
  schema: Schema
  fiddledRows: {
    tableName: string,
    row: any,
    result?: any,
    afterSettingResultHandlers: ((result: any) => Promise<void>)[]
  }[] = []

  constructor(schema: Schema) {
    this.schema = schema
  }

  add(tableName: string, row: any, fiddledRow?: any) {
    if (! this.containsRow(tableName, row)) {
      this.fiddledRows.push({ tableName: tableName, row: row, result: fiddledRow, afterSettingResultHandlers: [] })
    }
  }

  remove(row: any) {
    let index = -1

    for (let i = 0; i < this.fiddledRows.length; i++) {
      if (this.fiddledRows[i].row === row) {
        index = i
        break
      }
    }

    if (index > -1) {
      this.fiddledRows.splice(index, 1)
    }
  }

  async setResult(row: any, result: any): Promise<void> {
    let l = fiddledRowsLog.mt('setResult')
    l.param('row', row)
    l.param('result', result)

    l.dev('Trying to determine the fiddled row object which must exist at this point in time')

    let existingFiddledRow = undefined
    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.row === row) {
        existingFiddledRow = fiddledRow
      }
    }

    if (existingFiddledRow == undefined) {
      throw new Error('Could not set result because the row object was not already fiddled with')
    }

    existingFiddledRow.result = result
    l.dev('Setting given result on the existing fiddled row', existingFiddledRow)

    if (existingFiddledRow.afterSettingResultHandlers.length > 0) {
      l.lib('Calling every registered handler after the result was set')
  
      for (let fn of existingFiddledRow.afterSettingResultHandlers) {
        l.calling('Calling next result handler...')
        await fn(result)
        l.called('Called result handler')
      }
    }
    else {
      l.lib('There are no handler to be called after the result was set')
    }

    l.returning('Finished setting result. Returning...')
  }

  addAfterSettingResultHandler(row: any, handler: (result: any) => Promise<void>) {
    let existingFiddledRow = undefined
    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.row === row) {
        existingFiddledRow = fiddledRow
      }
    }

    if (existingFiddledRow == undefined) {
      throw new Error('Could not afterSettingResultHander because the row object was not already fiddled with')
    }

    existingFiddledRow.afterSettingResultHandlers.push(handler)
  }

  containsTableName(tableName: string): boolean {
    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.tableName === tableName) {
        return true
      }
    }
    return false
  }

  containsRow(tableName: string, row: any): boolean {
    let table = this.schema[tableName]

    if (table == undefined) {
      throw new Error('Table not contained in schema: ' + tableName)
    }

    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.row === row) {
        return true
      }

      if (rowsRepresentSameEntity(table, row, fiddledRow.row)) {
        return true
      }
    }

    return false
  }

  getResultByRow(tableName: string, row: any): any | undefined {
    let table = this.schema[tableName]

    if (table == undefined) {
      throw new Error('Table not contained in schema: ' + tableName)
    }

    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.row === row) {
        return fiddledRow.result
      }

      if (rowsRepresentSameEntity(table, row, fiddledRow.row)) {
        return fiddledRow.result
      }
    }
  }

  getByTableNameAndId(tableName: string, idColumnName: string, idColumnValue: any): any | undefined {
    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.tableName == tableName && fiddledRow.result != undefined) {
        if (fiddledRow.result[idColumnName] == idColumnValue) {
          return fiddledRow.result
        }
      }
    }
  }
}

