import { Criteria } from 'knight-criteria'
import { Log } from 'knight-log'
import sql, { comparison } from 'knight-sql'
import { count, instanceCriteriaToRowCriteria, select } from './criteria'
import { databaseIndependentQuery, InsertUpdateDeleteResult } from './query'
import { isUpdate, reduceToPrimaryKey } from './row'
import { Schema, Table } from './schema'

let log = new Log('knight-orm/orm.ts')

export interface StoredObjectsEntry {
  stored: boolean,
  obj: any,
  afterStorageHandlers: ((result: any) => Promise<void>)[]
}

let storedObjectsLog = log.cls('StoredObjects')

export class StoredObjects {
  entries: StoredObjectsEntry[] = []

  setRowAboutToBeStored(obj: any) {
    if (! this.isContained(obj)) {
      this.entries.push({
        stored: false,
        obj: obj,
        afterStorageHandlers: []
      } as StoredObjectsEntry)
    }
  }

  isAboutToBeStored(obj: any): boolean {
    let entry = this.getEntry(obj)
    return entry != undefined && ! entry.stored
  }

  async setStored(obj: any): Promise<void> {
    let l = storedObjectsLog.mt('setStored')
    let entry = this.getEntry(obj)

    if (entry == undefined) {
      throw new Error('Could not set as stored because the object was not set to be about to be stored.')
    }

    entry.stored = true

    if (entry.afterStorageHandlers.length > 0) {
      l.lib('Calling every registered handler after the result was set')
  
      for (let fn of entry.afterStorageHandlers) {
        l.calling('Calling next result handler...')
        await fn(entry.obj)
        l.called('Called result handler')
      }
    }
    else {
      l.lib('There are no handler to be called after the result was set')
    }

    l.returning('Returning...')
  }

  isStored(obj: any): boolean {
    let entry = this.getEntry(obj)
    return entry != undefined && entry.stored
  }

  getEntry(obj: any): StoredObjectsEntry|undefined {
    for (let entry of this.entries) {
      if (entry.obj === obj) {
        return entry
      }
    }
  }

  isContained(obj: any): boolean {
    return this.getEntry(obj) != undefined
  }

  remove(obj: any) {
    let index = -1

    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i].obj === obj) {
        index = i
        break
      }
    }

    if (index > -1) {
      this.entries.splice(index, 1)
    }
  }

  addAfterStorageHandler(obj: any, handler: (justStoredRow: any) => Promise<void>) {
    let entry = this.getEntry(obj)

    if (entry == undefined) {
      throw new Error('Could not addAfterStorageHandler because the given object is was not added yet. Use \'setAboutToBeStored\' to do so.')
    }

    entry.afterStorageHandlers.push(handler)
  }
}

export interface StoreOptions {
  asDatabaseRow?: boolean
}

/**
 * 
 * @param schema 
 * @param tableName 
 * @param db 
 * @param queryFn 
 * @param obj 
 * @param storedObjects 
 */
export async function store(
      table: Table, 
      db: string,
      queryFn: (sqlString: string, values?: any[]) => Promise<any>,
      obj: any,
      options?: StoreOptions,
      storedObjects: StoredObjects = new StoredObjects,
      relationshipPath: string = 'root'
    ): Promise<any> {

  let l = log.fn('store')
  l.locationSeparator = ' > '

  if (relationshipPath != undefined) {
    l.location = [ relationshipPath ]
  }
  else {
    l.location = []
  }

  l.param('table.name', table.name)
  l.param('db', db)
  l.param('obj', obj)
  l.param('options', options)
  l.dev('storedRows.rowEntries', storedObjects.entries)

  if (storedObjects.isContained(obj)) {
    l.lib('Row already stored. Returning...')
    return
  }

  let asDatabaseRow = options && options.asDatabaseRow === true ? true : false
  let storeInfo: any = {}
  storedObjects.setRowAboutToBeStored(obj)

  if (table.relationships.length > 0) {
    l.lib('Storing missing many-to-one or one-to-one relationships first to be able to assign their id\'s before storing the actual row')

    l.location.push('')

    for (let relationship of table.relationships) {
      l.location.pop()
      l.location.push(relationship.name)

      if (relationship.manyToOne !== true) {
        l.lib('Relationship is not many-to-one nor one-to-one. Skipping...')
        continue
      }

      let manyToOneObj = obj[relationship.name]

      if (manyToOneObj == undefined) {
        l.lib('There is no obj set for this relationship. Skipping...')
        continue
      }

      if (typeof manyToOneObj != 'object') {
        l.lib('The associated value for the relationship is not of type object. Skipping...')
        continue
      }

      l.lib('Relationship', relationship)

      if (! storedObjects.isContained(manyToOneObj)) {
        l.lib('There is a relationship object and it was not stored yet')
        l.calling('Storing it now...')
        
        let relationshipStoreInfo = await store(
          relationship.otherTable, 
          db, 
          queryFn, 
          obj[relationship.name], 
          options,
          storedObjects, 
          relationshipPath != undefined ? relationshipPath + '.' + relationship.name : relationship.name
        )

        l.called('Returned from storing the relationship object...')

        l.lib(`Setting the many-to-one id using the stored relationship object: ${relationship.thisId.getName(asDatabaseRow)} =`, relationshipStoreInfo[relationship.otherId.getName(asDatabaseRow)])
        obj[relationship.thisId.getName(asDatabaseRow)] = manyToOneObj[relationship.otherId.getName(asDatabaseRow)]
        
        l.dev('Adding store information for the relationship', relationshipStoreInfo)
        storeInfo[relationship.name] = relationshipStoreInfo
      }

      else if (manyToOneObj[relationship.otherId.getName(asDatabaseRow)] !== undefined) {
        l.lib(`Relationship object is about to be stored up the recursion chain but the needed id is already there. Setting it... ${relationship.thisId.getName(asDatabaseRow)} = ${manyToOneObj[relationship.otherId.getName(asDatabaseRow)]}`)
        obj[relationship.thisId.getName(asDatabaseRow)] = manyToOneObj[relationship.otherId.getName(asDatabaseRow)]
      }

      else if (storedObjects.isAboutToBeStored(manyToOneObj)) {
        l.lib('Object is about to be stored somewhere up the recursion chain. Adding handler which sets the id on the relationship owning object as soon as the relationship object is stored.')

        storedObjects.addAfterStorageHandler(manyToOneObj, async (justStoredManyToOneObj: any) => {
          let l = log.fn('afterStorageHandler')
          l.param('justStoredManyToOneObject', justStoredManyToOneObj)
          l.param('relationship', relationship)

          l.lib('Converting just stored object to a database row...')

          let row
          let justStoredManyToOneRow
          if (asDatabaseRow) {
            row = obj
            justStoredManyToOneRow = justStoredManyToOneObj
            l.lib('Given object should be treated as a database row')
          }
          else {
            l.lib('Converting instance to row')
            l.calling('Calling Table.instanceToRow...')
            let reduced = {
              [relationship.otherId.name]: obj[relationship.otherId.name]
            }
            justStoredManyToOneRow = table.instanceToRow(reduced, true)
            l.called('Called Table.instanceToRow...')

            l.lib('Converting instance to row')
            l.calling('Calling Table.instanceToRow...')
            reduced = reduceToPrimaryKey(table, obj)
            row = table.instanceToRow(reduced, true)
            l.called('Called Table.instanceToRow...')
          }

          l.lib('Updating row...', row)

          let query = sql.update(table.name)

          for (let column of table.primaryKey) {
            query.where(comparison(column.name, row[column.name]))
          }

          query.set(relationship.thisId.name, justStoredManyToOneRow[relationship.otherId.name])

          l.calling('Calling update...')
  
          let result
          try {
            result = await databaseIndependentQuery(db, queryFn, query.sql(db), query.values()) as InsertUpdateDeleteResult
          }
          catch (e) {
            throw new Error(e as any)
          }

          l.called('Called update...')
      
          if (result.affectedRows != 1) {
            throw new Error('Expected row count does not equal 1')
          }
        })    
      }

      else {
        throw new Error('Relationship object was already stored but it still does not contain the needed id for the many-to-one relationship.')
      }
    }

    l.location.pop()
  }

  l.lib('Converting object to a database row...')
  
  let row
  if (asDatabaseRow) {
    l.lib('Given object should be treated as a database row')
    row = obj
  }
  else {
    l.lib('Given object should be treated as an instance')
    l.calling('Calling Table.instanceToRow...')
    let reduced = reduceToPrimaryKey(table, obj)
    row = table.instanceToRow(reduced, true)
    l.called('Called Table.instanceToRow...')
  }

  l.lib('Determining if to store or to update the given row...', row)
  
  let doUpdate = await isUpdate(table, db, queryFn, row, asDatabaseRow)

  if (doUpdate) {
    l.lib('Updating the given row...')

    let query = sql.update(table.name)

    for (let column of table.columns) {
      if (column.primaryKey) {
        query.where(comparison(column.name, row[column.name]), 'AND')
      }
      else if (row[column.name] !== undefined) {
        query.value(column.name, row[column.name])
      }
    }

    let result
    try {
      result = await databaseIndependentQuery(db, queryFn, query.sql(db), query.values()) as InsertUpdateDeleteResult
    }
    catch (e) {
      throw new Error(e as any)
    }
  
    if (result.affectedRows != 1) {
      throw new Error(`Updated ${result.affectedRows} rows for ${relationshipPath}. Should have been exactly one row. Please enable logging for more information.`)
    }

    storeInfo['@update'] = true

    for (let column of table.primaryKey) {
      storeInfo[column.name] = obj[column.name]
    }
  }

  else {
    l.lib('Inserting the given row...')

    let query = sql.insertInto(table.name)

    for (let column of table.columns) {
      if (row[column.name] !== undefined) {
        query.value(column.name, row[column.name])
      }
    }

    let generatedPrimaryKey = table.generatedPrimaryKey

    let result
    try {
      result = await databaseIndependentQuery(db, queryFn, query.sql(db), query.values(), generatedPrimaryKey?.name) as InsertUpdateDeleteResult
    }
    catch (e) {
      throw new Error(e as any)
    }

    if (result.affectedRows != 1) {
      throw new Error(`Inserted ${result.affectedRows} rows for ${relationshipPath}. Should have been exactly one row.`)
    }

    storeInfo['@update'] = false

    for (let column of table.primaryKey) {
      storeInfo[column.getName(asDatabaseRow)] = obj[column.getName(asDatabaseRow)]
    }

    if (generatedPrimaryKey) {
      l.dev(`Setting generated primary key on object: ${generatedPrimaryKey.getName(asDatabaseRow)} = ${result.insertId}`)
      obj[generatedPrimaryKey.getName(asDatabaseRow)] = result.insertId
      l.dev(`Setting generated primary key on storage information: ${generatedPrimaryKey.getName(asDatabaseRow)} = ${result.insertId}`)
      storeInfo[generatedPrimaryKey.getName(asDatabaseRow)] = result.insertId
    }
  }

  l.lib('Storage information', storeInfo)
  l.calling('Triggering actions that can be down now after this object was stored...')

  try {
    await storedObjects.setStored(obj)
  }
  catch (e) {
    throw new Error(e as any)
  }

  l.called('Triggered actions after object was stored')

  if (table.relationships.length > 0) {
    l.lib('Storing one-to-many relationship objects and setting one-to-one back references...')

    l.location.push('')

    for (let relationship of table.relationships) {
      l.location.pop()
      l.location.push(relationship.name)
      
      let otherTable = relationship.otherTable

      if (relationship.manyToOne && relationship.otherRelationship) {
        let oneToOneObj = obj[relationship.name]

        if (oneToOneObj == undefined) {
          l.lib('There is no object set for this one-to-one relationship. Skipping...')
          continue
        }

        if (typeof oneToOneObj != 'object') {
          l.lib('The associated value for the relationship is not of type object. Skipping...', oneToOneObj)
          continue
        }

        l.lib('Relationship', relationship)
        let otherRelationship = relationship.otherRelationship

        if (! storedObjects.isContained(oneToOneObj)) {
          throw new Error('One-to-one object is neither to be stored nor stored. This is an invalid state because any many-to-one object should have already been processed. Please contact the library programmer.')
        }

        else if (storedObjects.isAboutToBeStored(oneToOneObj)) {
          l.lib('One-to-one object is about to be stored', oneToOneObj)
          l.lib(`Setting its many-to-one relationship id which references back -> ${otherRelationship.thisId.getName(asDatabaseRow)} =`, obj[otherRelationship.otherId.getName(asDatabaseRow)])
          oneToOneObj[otherRelationship.thisId.getName(asDatabaseRow)] = obj[otherRelationship.otherId.getName(asDatabaseRow)]
        }

        else {
          l.lib('One-to-one object was already stored', oneToOneObj)
          l.lib(`Setting its many-to-one relationship id which references back -> ${otherRelationship.thisId.getName(asDatabaseRow)} =`, obj[otherRelationship.otherId.getName(asDatabaseRow)])

          l.lib('Converting just stored object to a database row...')

          let row
          let oneToOneRow
          if (options && options.asDatabaseRow === true) {
            row = obj
            oneToOneRow = oneToOneObj
            l.lib('Given object should be treated as a database row')
          }
          else {
            l.lib('Converting instance to row')
            l.calling('Calling Table.instanceToRow...')
            let reduced = {
              [otherRelationship.otherId.propertyName]: obj[otherRelationship.otherId.propertyName]
            }
            row = table.instanceToRow(reduced, true)
            l.called('Called Table.instanceToRow...')

            l.lib('Converting one-to-one instance to row')
            l.calling('Calling Table.instanceToRow...')
            reduced = reduceToPrimaryKey(table, oneToOneObj)
            oneToOneRow = table.instanceToRow(reduced, true)
            l.called('Called Table.instanceToRow...')
          }

          l.lib('Updating row...', row)

          let query = sql.update(otherTable.name)
    
          for (let column of otherTable.primaryKey) {
            if (row[column.name] === undefined) {
              throw new Error('Some columns of primary are not set.')
            }

            query.where(comparison(column.name, oneToOneRow[column.name]))
          }

          query.set(otherRelationship.thisId.name, row[otherRelationship.otherId.name])

          l.calling('Calling update...')
  
          let result
          try {
            result = await databaseIndependentQuery(db, queryFn, query.sql(db), query.values()) as InsertUpdateDeleteResult
          }
          catch (e) {
            throw new Error(e as any)
          }

          l.called('Called update...')
      
          if (result.affectedRows != 1) {
            throw new Error(`When trying to set and store the other side of a one-to-one relationship in the database, the amount of affected rows '${result.affectedRows}' did not not equal 1.`)
          }
        }
      }

      else if (relationship.oneToMany) {
        let oneToManyArray = obj[relationship.name]

        if (oneToManyArray == undefined) {
          l.lib('There is no array set for this one-to-many relationship. Skipping...')
          continue
        }

        if (! (oneToManyArray instanceof Array)) {
          l.lib('Relationship is one-to-many but given relationship value is not of type array. Skipping...', oneToManyArray)
          continue
        }

        if (oneToManyArray.length == 0) {
          l.lib('One-to-many relationship is an array but it has 0 entries. Skipping...')
          continue
        }

        l.lib('One-to-many relationship is an array. Iterating through every one-to-many object...')

        for (let oneToManyObj of oneToManyArray) {
          if (! storedObjects.isContained(oneToManyObj)) {
            l.lib('One-to-many object was not stored yet', oneToManyObj)
            
            l.lib(`Setting many-to-one relationship id on the one-to-many object: ${relationship.otherId.getName(asDatabaseRow)} = ${obj[relationship.thisId.getName(asDatabaseRow)]}`)
            oneToManyObj[relationship.otherId.getName(asDatabaseRow)] = obj[relationship.thisId.getName(asDatabaseRow)]
            
            l.called('Storing the row...')
            let relationshipStoreInfo = await store(
              relationship.otherTable, 
              db, 
              queryFn, 
              oneToManyObj, 
              options, 
              storedObjects, 
              relationshipPath != undefined ? relationshipPath + '.' + relationship.name : relationship.name
            )
  
            l.called('Returned from storing relationship row...')
            
            if (relationshipStoreInfo) {
              if (storeInfo[relationship.name] == undefined) {
                storeInfo[relationship.name] = []
              }
  
              storeInfo[relationship.name].push(relationshipStoreInfo)
            }
          }
  
          else if (storedObjects.isAboutToBeStored(oneToManyObj)) {
            l.lib('One-to-many object is about to be stored up the recursion chain', oneToManyObj)

            if (oneToManyObj[relationship.otherId.getName(asDatabaseRow)] === undefined) {
              l.lib(`The many-to-one id referencing this one-to-many object is not set. Setting it: ${relationship.otherId.getName(asDatabaseRow)} =`, obj[relationship.thisId.getName(asDatabaseRow)])
              oneToManyObj[relationship.otherId.getName(asDatabaseRow)] = obj[relationship.thisId.getName(asDatabaseRow)]
            }
            else {
              l.lib('The many-to-one id referencing back to this one-to-many object is already set which means that this object is part of a many-to-many relationship')
            }
          }
  
          else {
            l.lib('One-to-many object was already stored', oneToManyObj)

            if (oneToManyObj[relationship.otherId.getName(asDatabaseRow)] === undefined) {
              l.lib(`The many-to-one id referencing this one-to-many object is not set. Setting it in the database: ${relationship.otherId.getName(asDatabaseRow)} =`, obj[relationship.thisId.getName(asDatabaseRow)])
  
              let row
              let oneToManyRow
              if (options && options.asDatabaseRow === true) {
                row = obj
                oneToManyRow = oneToManyObj
                l.lib('Given object should be treated as a database row')
              }
              else {
                l.lib('Converting instance to row')
                l.calling('Calling Table.instanceToRow...')
                let reduced = {
                  [relationship.thisId.name]: obj[relationship.thisId.name]
                }
                row = table.instanceToRow(reduced, true)
                l.called('Called Table.instanceToRow...')
    
                l.lib('Converting one-to-many instance to row')
                l.calling('Calling Table.instanceToRow...')
                reduced = reduceToPrimaryKey(table, oneToManyObj)
                oneToManyRow = table.instanceToRow(reduced, true)
                l.called('Called Table.instanceToRow...')
              }
    
              l.lib('Updating row...', row)

              let query = sql.update(relationship.otherTable.name)
      
              for (let column of otherTable.primaryKey) {
                if (obj[column.name] === undefined) {
                  throw new Error('Could not set the many-to-one id on one-to-many row because not all primary key columns are set. Please contact the library programmer.')
                }
    
                query.where(comparison(column.name, oneToManyRow[column.name]))
              }
    
              query.set(relationship.otherId.name, row[relationship.thisId.name])
    
              l.calling('Calling update...')
      
              let result
              try {
                result = await databaseIndependentQuery(db, queryFn, query.sql(db), query.values()) as InsertUpdateDeleteResult
              }
              catch (e) {
                throw new Error(e as any)
              }
    
              l.called('Called update...')
          
              if (result.affectedRows != 1) {
                throw new Error('Expected row count does not equal 1')
              }
            }
            else {
              l.lib('The many-to-one id referencing back to this one-to-many object is already set which means that this object is part of a many-to-many relationship')
            }
          }    
        }
      }
    }

    l.location.pop()
  }
    
  l.returning('Returning storage information...', storeInfo)
  return storeInfo
}

export async function delete_(
  table: Table,
  db: string,
  queryFn: (sqlString: string, values?: any[]) => Promise<any>,
  obj: any,
  asDatabaseRow = false
): Promise<any> {
}

export class Orm {
  schema: Schema
  db: string

  constructor(schema: Schema, db: string) {
    this.schema = schema
    this.db = db
  }

  store<T>(queryFn: (sqlString: string, values?: any[]) => Promise<any>, className: new (...args: any[]) => T, instance: T): Promise<any> {
    return store(this.schema.getTableByClassName(className), this.db, queryFn, instance)
  }

  async read<T>(queryFn: (sqlString: string, values?: any[]) => Promise<any>, className: new (...args: any[]) => T, criteria: Criteria): Promise<T[]> {
    let table = this.schema.getTableByClassName(className)
    let rowCriteria = instanceCriteriaToRowCriteria(table, criteria)
    let rows = await select(table, this.db, queryFn, rowCriteria)
    let instances = table.rowToInstance(rows)
    return instances
  }

  count(queryFn: (sqlString: string, values?: any[]) => Promise<any>, className: new (...args: any[]) => any, criteria: Criteria): Promise<number> {
    let table = this.schema.getTableByClassName(className)
    let rowCriteria = instanceCriteriaToRowCriteria(table, criteria)
    return count(table, this.db, queryFn, rowCriteria)
  }

  delete<T>(queryFn: (sqlString: string, values?: any[]) => Promise<any>, className: new (...args: any[]) => T, instance: T): Promise<any> {
    let table = this.schema.getTableByClassName(className)
    return delete_(table, this.db, queryFn, instance)
  }
}
