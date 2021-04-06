import { Criteria, ReadCriteria } from 'knight-criteria'
import Log from 'knight-log'
import sql from 'knight-sql'
import { fillReadCriteria, fillUpdateCriteria } from 'knight-sql-criteria-filler'
import { instanceCriteriaToRowCriteria, instanceToDeleteCriteria, rowToUpdateCriteria } from './criteriaTools'
import { delete_ as isudDelete, insert, select } from './isud'
import { buildCountQuery } from './queryTools'
import { idsNotSet, instanceToRow, rowToInstance } from './rowTools'
import { Schema } from './Schema'
import { FiddledRows } from './util'

let log = new Log('knight-orm/crud.ts')

export async function create<T>(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, instance: T): Promise<T> {
  let l = log.fn('create')
  l.param('db', db)
  l.param('instance', instance)

  let row = instanceToRow(schema, tableName, instance)
  l.var('row', row)
  let insertedRow = await insert(schema, tableName, db, queryFn, row)
  l.var('insertedRow', insertedRow)
  let insertedInstance = rowToInstance(schema, tableName, insertedRow)
  l.returning('Returning insertedInstance...', insertedInstance)
  return insertedInstance
}

export async function read<T>(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: ReadCriteria): Promise<T[]> {
  let l = log.fn('read')
  l.param('tableName', tableName)
  l.param('criteria', criteria)

  let rowCriteria = instanceCriteriaToRowCriteria(schema, tableName, criteria)
  l.var('rowCriteria', rowCriteria)

  let rows = await select(schema, tableName, db, queryFn, rowCriteria)
  l.var('rows', rows)

  let instances: T[] = []

  for (let row of rows) {
    let instance = rowToInstance(schema, tableName, row)
    instances.push(instance)
  }
  
  l.returning('Returning instances...', instances)
  return instances
}

export async function count(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: Criteria): Promise<number> {
  let l = log.fn('count')
  l.param('db', db)
  l.param('criteria', criteria)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let rowCriteria = instanceCriteriaToRowCriteria(schema, tableName, criteria)
  l.var('rowCriteria', rowCriteria)

  let query = buildCountQuery(schema, tableName, rowCriteria)

  let sqlString = query.sql(db)
  let values = query.values()

  l.var('sqlString', sqlString)
  l.var('values', values)

  let rows = await queryFn(sqlString, values)
  let rowCount = parseInt(rows[0].count)

  l.returning('Returning rowCount...', rowCount)
  return rowCount
}

export async function update<T>(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, instance: Partial<T>, alreadyUpdatedRows: FiddledRows = new FiddledRows(schema)): Promise<T> {
  let l = log.fn('update')
  l.param('db', db)
  l.param('instance', instance)
  l.param('alreadyUpdatedRows', alreadyUpdatedRows.fiddledRows)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let row = table.instanceToRow(instance)
  l.var('row', row)

  if (row == undefined) {
    throw new Error('Could not convert the given instance into a row')
  }

  if (alreadyUpdatedRows.containsRow(tableName, row)) {
    let alreadyUpdatedRow = alreadyUpdatedRows.getResultByRow(tableName, row)
    l.dev('Row object was already inserted. Returning already updated row...', alreadyUpdatedRow)
    return alreadyUpdatedRow
  }

  let criteria = rowToUpdateCriteria(schema, tableName, row)
  l.var('criteria', criteria)

  let missingIdValues = idsNotSet(table, criteria)
  if (missingIdValues.length > 0) {
    throw new Error('Not all id\'s are set. ' + JSON.stringify(missingIdValues))
  }

  let hasValuesToSet = false
  for (let column of Object.keys(criteria['@set'])) {
    if (criteria['@set'][column] !== undefined) {
      hasValuesToSet = true
      break
    }
  }

  let updatedRow = undefined

  if (hasValuesToSet) {
    l.user('There is something to set. Updating...')
    let query = sql.update(tableName)
    fillUpdateCriteria(query, criteria, Object.keys(table.columns))

    if (query._wheres.length > 0)

    if (db == 'postgres') {
      query.returning('*')
    }
  
    let sqlString = query.sql(db)
    let values = query.values()
  
    l.var('sqlString', sqlString)
    l.var('values', values)
  
    let updatedRows = await queryFn(sqlString, values)
    l.var('updatedRows', updatedRows)
  
    if (updatedRows.length != 1) {
      throw new Error('Expected row count does not equal 1')
    }
  
    updatedRow = updatedRows[0]
    l.var('updatedRow', updatedRow)
  }
  else {
    l.user('No column to set given. Loading entity...')
    // remove the set property from the criteria to only have left the ids for selecting
    delete (criteria as any).set

    let query = sql.select('*').from(tableName)
    fillReadCriteria(query, criteria, Object.keys(table.columns))

    let sqlString = query.sql(db)
    let values = query.values()

    let selectedRows = await queryFn(sqlString, values)

    if (selectedRows.length != 1) {
      throw new Error('Expected row count does not equal 1')
    }

    updatedRow = selectedRows[0]
  }

  let updatedInstance = table.rowToInstance(updatedRow)
  alreadyUpdatedRows.add(tableName, row, updatedInstance)

  l.user('Update relationships...')

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.var('relationshipName', relationshipName)
  
      if (typeof (instance as any)[relationshipName] == 'object' && (instance as any)[relationshipName] !== null) {
        let relationship = table.relationships[relationshipName]
  
        if (relationship.manyToOne) {
          l.user('Many-to-one relationship')
          l.user('Updating. Going into recursion...')
          let updatedRelationshipInstance = await update(schema, relationship.otherTable, db, queryFn, (instance as any)[relationshipName], alreadyUpdatedRows)
          l.returning('Returning from recursion...')
          updatedInstance[relationshipName] = updatedRelationshipInstance
        }
        else if ((instance as any)[relationshipName] instanceof Array) {
          l.user('One-to-many relationship. Iterating through all relationhip rows...')
          updatedInstance[relationshipName] = []
  
          for (let relationshipInstance of (instance as any)[relationshipName]) {
            l.user('Updating. Going into recursion...')
            let updatedRelationshipInstance = await update(schema, relationship.otherTable, db, queryFn, relationshipInstance, alreadyUpdatedRows)
            l.returning('Returning from recursion...')            
            updatedInstance[relationshipName].push(updatedRelationshipInstance)
          }
        }
        else {
          l.user('Was neither a many-to-one relationship nor was the correspinding object of type Array')
        }
      }
      else {
        l.user('Relationship is not of type object or null. Continuing...')
      }
    }  
  }

  l.returning('Returning updatedInstance...', updatedInstance)
  return updatedInstance
}

export async function delete_<T>(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, instance: T): Promise<T> {
  let l = log.fn('delete_')
  l.param('instance', instance)

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let criteria = instanceToDeleteCriteria(schema, tableName, instance)
  l.user('Converted instance to delete criteria', criteria)

  let missingIdValues = idsNotSet(table, criteria)
  l.var('missingIdValues', missingIdValues)

  if (missingIdValues.length > 0) {
    throw new Error('Not all id\'s are set. ' + JSON.stringify(missingIdValues))
  }

  let deletedRows = await isudDelete(schema, tableName, db, queryFn, criteria)
  l.var('deletedRows', deletedRows)

  if (deletedRows.length != 1) {
    throw new Error('Expected row count does not equal 1')
  }

  let deletedRow = deletedRows[0]
  let deletedInstance = rowToInstance(schema, tableName, deletedRow)
  l.returning('Returning deleted instance...', deletedInstance)
  return deletedInstance
}
