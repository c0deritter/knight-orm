import { Log } from 'knight-log'
import { From, Join, Query } from 'knight-sql'
import { Schema } from './schema'

let log = new Log('knight-orm/query.ts')

export interface InsertUpdateDeleteResult {
  affectedRows: number
  insertId?: number
}

export type SelectResult = any[]

export async function databaseIndependentQuery(
  db: string,
  queryFn: (sqlString: string, values?: any[]) => Promise<any>,
  sqlString: string,
  values?: any[],
  insertIdColumnName?: string
): Promise<InsertUpdateDeleteResult | SelectResult> {

  let l = log.fn('databaseIndependentQuery')
  l.param('db', db)
  l.param('sqlString', sqlString)
  l.param('values', values)
  l.param('insertIdColumnName', insertIdColumnName)

  let isInsert = sqlString.substring(0, 6).toUpperCase() == 'INSERT'

  if (isInsert && db == 'postgres') {
    if (insertIdColumnName) {
      l.lib('Given query is INSERT, database is PostgreSQL and there is an primary key column which is created. Appending RETURNING statement.')
      sqlString += ' RETURNING ' + insertIdColumnName
      l.lib('Resulting SQL string', sqlString)
    }
    else {
      l.lib('Given query is INSERT, database is PostgreSQL but there is no primary key column which is created. Will not return any generated id.')
    }
  }

  let dbResult
  try {
    dbResult = await queryFn(sqlString, values)
  }
  catch (e) {
    throw new Error(e as any)
  }

  l.dev(`Result of database '${db}'`, dbResult)

  if (sqlString.substring(0, 6).toUpperCase() == 'SELECT') {
    if (db == 'postgres') {
      if (! ('rows' in dbResult) || ! (dbResult.rows instanceof Array)) {
        throw new Error('Result returned by PostgeSQL did not contain a valid \'rows\'. Expected an array. Enable logging for more information.')
      }
  
      l.returning('Returning rows of SELECT', dbResult.rows)
      return dbResult.rows as SelectResult
    }
  
    if (db == 'mysql' || db == 'maria') {
      if (! (dbResult instanceof Array)) {
        throw new Error('Result returned by MySQL was not any array. Enable logging for more information.')
      }
  
      l.returning('Returning rows of SELECT', dbResult)
      return dbResult
    }

    throw new Error(`Database '${db}' not supported.`)
  }

  else {
    let affectedRows

    if (db == 'postgres') {
      if (! ('rowCount' in dbResult) || typeof dbResult.rowCount != 'number' || isNaN(dbResult.rowCount)) {
        throw new Error('Result returned by PostgeSQL did not contain a valid \'rowCount\'. Expected a number. Enable logging for more information.')
      }
  
      affectedRows = dbResult.rowCount
    }
  
    if (db == 'mysql' || db == 'maria') {
      if (! ('affectedRows' in dbResult) || typeof dbResult.affectedRows != 'number' || isNaN(dbResult.affectedRows)) {
        throw new Error('Result returned by MySQL did not contain a valid \'affectedRows\'. Expected a number. Enable logging for more information.')
      }
  
      affectedRows = dbResult.affectedRows
    }

    let result = {
      affectedRows: affectedRows
    } as InsertUpdateDeleteResult

    if (! isInsert) {
      l.returning('Returning UPDATE or DELETE result', result)
      return result
    }

    if (db == 'postgres') {
      if (insertIdColumnName) {
        if (! ('rows' in dbResult) || ! (dbResult.rows instanceof Array) || dbResult.rows.length != 1) {
          throw new Error('Result returned by PostgreSQL did not contain valid \'rows\'. Expected an array with exactly one row. Enable logging for more information.')
        }
  
        let insertId = dbResult.rows[0][insertIdColumnName]
  
        if (insertId == undefined) {
          throw new Error('Could not determine \'insertId\' for PostgreSQL INSERT query. The given insert id column name was not contained in the returned row. Enable logging for more information.')
        }
  
        result.insertId = insertId
      }

      l.lib('Returning INSERT result', result)
      return result
    }

    if (db == 'mysql' || db == 'maria') {
      if (dbResult.insertId != undefined) {
        let result = {
          affectedRows: affectedRows,
          insertId: dbResult.insertId
        } as InsertUpdateDeleteResult

        l.lib('Returning INSERT result', result)
        return result
      }
  
      let result = {
        affectedRows: affectedRows
      } as InsertUpdateDeleteResult

      l.lib('Returning INSERT result', result)
      return result
    }

    throw new Error(`Database '${db}' not supported.`)
  }
}

export function selectAllColumnsExplicitly(schema: Schema, query: Query) {
  if (query._from && query._from.pieces) {
    for (let from of query._from.pieces) {
      if (from instanceof From) {
        let fromTable = schema.getTable(from.table)
    
        for (let column of fromTable.columns) {
          let alias = from.alias != undefined && from.alias.length > 0 ? from.alias : undefined
          query.select((alias != undefined ? alias + '.' : '') + column.name + ' ' + (alias != undefined ? '"' + alias + '__' + column.name + '"' : ''))
        }
      }
    }
  }

  if (query._join && query._join.pieces) {
    for (let join of query._join.pieces) {
      if (join instanceof Join) {
        let joinTable = schema.getTable(join.table)
  
        for (let column of joinTable.columns) {
          let alias = join.alias != undefined && join.alias.length > 0 ? join.alias : undefined
          query.select((alias != undefined ? alias + '.' : '') + column.name + ' ' + (alias != undefined ? '"' + alias + '__' + column.name + '"' : ''))
        }  
      }
    }
  }
}
