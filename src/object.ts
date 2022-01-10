import { Log } from 'knight-log'
import sql, { comparison } from 'knight-sql'
import { Orm } from '.'
import { SelectResult } from './query'
import { Schema, Table } from './schema'

let log = new Log('knight-orm/row.ts')

let objectToolsLog = log.cls('ObjectTools')

export class ObjectTools {
  orm: Orm

  constructor(orm: Orm) {
    this.orm = orm
  }

  get schema(): Schema {
    return this.orm.schema
  }

  get db(): string {
    return this.orm.db
  }

  async isUpdate(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    queryFn: (sqlString: string, values?: any[]) => Promise<any>,
    obj: any,
    asDatabaseRow = false
  ): Promise<boolean> {
    
    let l = objectToolsLog.mt('isUpdate')
    l.param('obj', obj)
  
    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    if (! this.areAllNotGeneratedPrimaryKeyColumnsSet(table, obj, asDatabaseRow)) {
      throw new Error(`At least one not generated primary key field (${table.notGeneratedPrimaryKey.map(column => column.name).join(', ')}) is not set. Enable logging for more details.`)
    }
  
    let hasNotGeneratedPrimaryKeys = false
    let generatedPrimaryKeyCount = 0
    let generatedPrimaryKeyIsNull = true
    let generatedPrimaryKeyIsNotNull = true
  
    for (let column of table.primaryKey) {
      if (column.generated) {
        generatedPrimaryKeyCount++
  
        if (obj[column.getName(asDatabaseRow)] == null) {
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
  
    if (generatedPrimaryKeyCount == 1 && ! generatedPrimaryKeyIsNull && ! generatedPrimaryKeyIsNotNull) {
      throw new Error('There is a generated primary key which are null and generated primary keys which are not null. This is an inconsistent set of values. Cannot determine if the object is to be inserted or to be updated. Please enable logging for more details.')
    }
  
    if ((generatedPrimaryKeyCount == 1 && generatedPrimaryKeyIsNotNull || ! generatedPrimaryKeyCount) && hasNotGeneratedPrimaryKeys) {
      l.lib('The object does not have generated primary key fields. Determining if the object was already inserted.')
      
      let row
      if (asDatabaseRow === true) {
        row = obj
      }
      else {
        let reduced = this.reduceToPrimaryKey(table, obj)
        row = table.instanceToRow(reduced, true)
      }
  
      let query = sql.select('*').from(table.name)
  
      for (let column of table.primaryKey) {
        query.where(comparison(column.name, row[column.name]), 'AND')
      }
  
      let rows
      try {
        rows = await this.orm.queryTools.databaseIndependentQuery(queryFn, query.sql(this.db), query.values()) as SelectResult
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
  
  isPrimaryKeySet(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    obj: any, 
    asDatabaseRow = false
  ): boolean {

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    for (let column of table.primaryKey) {
      if (obj[column.getName(asDatabaseRow)] == null) {
        return false
      }
    }
    
    return true
  }
  
  areAllNotGeneratedPrimaryKeyColumnsSet(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    obj: any, 
    asDatabaseRow = false
  ): boolean {

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    for (let column of table.notGeneratedPrimaryKey) {
      if (obj[column.getName(asDatabaseRow)] == null) {
        return false
      }
    }
    
    return true
  }

  isAtLeastOneNotPrimaryKeyColumnSet(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    obj: any, 
    asDatabaseRow = false
  ): boolean {

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    for (let column of table.notPrimaryKey) {
      if (obj[column.getName(asDatabaseRow)] !== undefined) {
        return true
      }
    }
    
    return false
  }
  
  objectsRepresentSameEntity(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    obj1: any, 
    obj2: any, 
    asDatabaseRows = false
  ): boolean {

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    if (obj1 == undefined || obj2 == undefined) {
      return false
    }
  
    if (table.primaryKey.length == 0) {
      return false
    }
  
    for (let column of table.primaryKey) {
      if (obj1[column.getName(asDatabaseRows)] === undefined || obj1[column.getName(asDatabaseRows)] !== obj2[column.getName(asDatabaseRows)]) {
        return false
      }
    }
  
    return true
  }
  
  reduceToPrimaryKey(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    obj: any, 
    asDatabaseRow = false
  ): any {
    
    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    let reduced: any = {}
    
    for (let column of table.columns) {
      if (column.primaryKey) {
        reduced[column.getName(asDatabaseRow)] = obj[column.getName(asDatabaseRow)]
      }
    }
  
    return reduced
  }  
}
