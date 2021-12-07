import { Criteria } from 'knight-criteria'
import { Log } from 'knight-log'
import sql from 'knight-sql'
import { buildCriteriaCountQuery, criteriaDelete as criteriaDelete, instanceCriteriaToRowCriteria, criteriaSelect } from './criteria'
import { store, StoredObjects } from './orm'
import { Table } from './schema'

let log = new Log('knight-orm/crud.ts')

export async function create<T>(table: Table, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, instance: T): Promise<T> {
  let l = log.fn('create')
  l.param('db', db)
  l.param('instance', instance)

  let row = table.instanceToRow(instance)
  l.lib('row', row)
  let insertedRow = await store(table, db, queryFn, row)
  l.lib('insertedRow', insertedRow)
  let insertedInstance = table.rowToInstance(insertedRow)
  l.returning('Returning insertedInstance...', insertedInstance)
  return insertedInstance
}

export async function read<T>(table: Table, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: Criteria): Promise<T[]> {
  let l = log.fn('read')
  l.param('table.name', table.name)
  l.param('criteria', criteria)

  let rowCriteria = instanceCriteriaToRowCriteria(table, criteria)
  l.lib('rowCriteria', rowCriteria)

  let rows = await criteriaSelect(table, db, queryFn, rowCriteria)
  l.lib('rows', rows)

  let instances: T[] = []

  for (let row of rows) {
    let instance = table.rowToInstance(row)
    instances.push(instance)
  }
  
  l.returning('Returning instances...', instances)
  return instances
}

export async function count(table: Table, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: Criteria): Promise<number> {
  let l = log.fn('count')
  l.param('db', db)
  l.param('criteria', criteria)

  let rowCriteria = instanceCriteriaToRowCriteria(table, criteria)
  l.lib('rowCriteria', rowCriteria)

  let query = buildCriteriaCountQuery(table, rowCriteria)

  let sqlString = query.sql(db)
  let values = query.values()

  l.lib('sqlString', sqlString)
  l.lib('values', values)

  let rows = await queryFn(sqlString, values)
  let rowCount = parseInt(rows[0].count)

  l.returning('Returning rowCount...', rowCount)
  return rowCount
}

export async function update<T>(table: Table, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, instance: Partial<T>, alreadyUpdatedRows: StoredObjects = new StoredObjects): Promise<T> {
  let l = log.fn('update')
  l.param('db', db)
  l.param('instance', instance)
  l.param('alreadyUpdatedRows', alreadyUpdatedRows.entries)

  let row = {} //table.instanceToRow(instance) TODO: !!!
  l.lib('row', row)

  if (row == undefined) {
    throw new Error('Could not convert the given instance into a row')
  }

  // if (alreadyUpdatedRows.containsOriginalRow(tableName, row)) {
  //   let alreadyUpdatedRow = alreadyUpdatedRows.getStoredRowByOriginalRow(tableName, row)
  //   l.dev('Row object was already inserted. Returning already updated row...', alreadyUpdatedRow)
  //   return alreadyUpdatedRow
  // }

  let criteria: any = {}//rowToUpdateCriteria(schema, tableName, row) // TODO: Remove :any
  l.lib('criteria', criteria)

  let missingIdValues: string[] = [] //idsNotSet(table, criteria)
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
    l.lib('There is something to set. Updating...')
    let query = sql.update(table.name)
    // fillUpdateCriteria(query, criteria, Object.keys(table.columns))

    // if (query._where && query._where.pieces && query._where.pieces.length > 0)

    if (db == 'postgres') {
      query.returning('*')
    }
  
    let sqlString = query.sql(db)
    let values = query.values()
  
    l.lib('sqlString', sqlString)
    l.lib('values', values)
  
    let updatedRows = await queryFn(sqlString, values)
    l.lib('updatedRows', updatedRows)
  
    if (updatedRows.length != 1) {
      throw new Error('Expected row count does not equal 1')
    }
  
    updatedRow = updatedRows[0]
    l.lib('updatedRow', updatedRow)
  }
  else {
    l.lib('No column to set given. Loading entity...')
    // remove the set property from the criteria to only have left the ids for selecting
    delete (criteria as any).set

    let query = sql.select('*').from(table.name)
    // fillReadCriteria(query, criteria, Object.keys(table.columns))

    let sqlString = query.sql(db)
    let values = query.values()

    let selectedRows = await queryFn(sqlString, values)

    if (selectedRows.length != 1) {
      throw new Error('Expected row count does not equal 1')
    }

    updatedRow = selectedRows[0]
  }

  let updatedInstance: any = {} //table.rowToInstance(updatedRow) TODO: !!!
  // alreadyUpdatedRows.add(tableName, row, updatedInstance)

  l.lib('Update relationships...')

  if (table.relationships != undefined) {
    for (let relationship of table.relationships) {
      l.lib('relationshipName', relationship.name)
  
      if (typeof (instance as any)[relationship.name] == 'object' && (instance as any)[relationship.name] !== null) {
        if (relationship.manyToOne) {
          l.lib('Many-to-one relationship')
          l.lib('Updating. Going into recursion...')
          let updatedRelationshipInstance = await update(relationship.otherTable, db, queryFn, (instance as any)[relationship.name], alreadyUpdatedRows)
          l.returning('Returning from recursion...')
          updatedInstance[relationship.name] = updatedRelationshipInstance
        }
        else if ((instance as any)[relationship.name] instanceof Array) {
          l.lib('One-to-many relationship. Iterating through all relationhip rows...')
          updatedInstance[relationship.name] = []
  
          for (let relationshipInstance of (instance as any)[relationship.name]) {
            l.lib('Updating. Going into recursion...')
            let updatedRelationshipInstance = await update(relationship.otherTable, db, queryFn, relationshipInstance, alreadyUpdatedRows)
            l.returning('Returning from recursion...')            
            updatedInstance[relationship.name].push(updatedRelationshipInstance)
          }
        }
        else {
          l.lib('Was neither a many-to-one relationship nor was the correspinding object of type Array')
        }
      }
      else {
        l.lib('Relationship is not of type object or null. Continuing...')
      }
    }  
  }

  l.returning('Returning updatedInstance...', updatedInstance)
  return updatedInstance
}

export async function delete_<T>(table: Table, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, instance: T): Promise<T> {
  let l = log.fn('delete_')
  l.param('instance', instance)

  let criteria = {} //instanceToDeleteCriteria(schema, tableName, instance)
  l.lib('Converted instance to delete criteria', criteria)

  let missingIdValues: string[] = [] //idsNotSet(table, criteria)
  l.lib('missingIdValues', missingIdValues)

  if (missingIdValues.length > 0) {
    throw new Error('Not all id\'s are set. ' + JSON.stringify(missingIdValues))
  }

  let deletedRows = await criteriaDelete(table, db, queryFn, criteria)
  l.lib('deletedRows', deletedRows)

  if (deletedRows.length != 1) {
    throw new Error('Expected row count does not equal 1')
  }

  let deletedRow = deletedRows[0]
  let deletedInstance = table.rowToInstance(deletedRow)
  l.returning('Returning deleted instance...', deletedInstance)
  return deletedInstance
}
