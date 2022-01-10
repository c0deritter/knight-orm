import { Criteria } from 'knight-criteria'
import { Log } from 'knight-log'
import sql, { comparison, Query } from 'knight-sql'
import { CriteriaTools } from './criteria'
import { JoinAlias } from './join'
import { ObjectTools } from './object'
import { InsertUpdateDeleteResult, QueryTools, SelectResult } from './query'
import { Schema, Table } from './schema'

let log = new Log('knight-orm/orm.ts')

export type QueryFn = (sqlString: string, values?: any[]) => Promise<any>

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

export type StoreFunction = (
  queryFn: QueryFn, 
  classNameOrTable: (new (...args: any[]) => any)|Table, 
  obj: any, 
  asDatabaseRow?: boolean, 
  storedObjects?: StoredObjects,
  relationshipPath?: string
) => Promise<any>

export interface UpdateCriteria {
  [column: string]: any
  '@criteria': Criteria
}

let ormLog = log.cls('Orm')

export class Orm {
  schema: Schema
  db: string

  customFunctions: { [className: string]: {
    store?: StoreFunction
  }} = {}

  criteriaTools: CriteriaTools
  objectTools: ObjectTools
  queryTools: QueryTools

  constructor(schema: Schema, db: string) {
    this.schema = schema
    this.db = db

    this.criteriaTools = new CriteriaTools(this)
    this.objectTools = new ObjectTools(this)
    this.queryTools = new QueryTools(this)
  }

  get customStoreFunctions(): { [className: string]: StoreFunction } {
    let result: { [className: string]: StoreFunction } = {}

    for (let className of Object.keys(this.customFunctions)) {
      if ('store' in this.customFunctions[className]) {
        result[className] = this.customFunctions[className].store!
      }
    }

    return result
  }

  /**
   * Stores the given object including all its relationship objects
   * into the database. The object might reference object properties
   * or database columns.
   * 
   * It uses 'isUpdate' to determine if an object is to be stored with
   * an SQL INSERT or an UPDATE.
   * 
   * The many-to-one relationships are stored first which will give you
   * the chance to use foreign key constraints. Beware that there are
   * circumstances where the many-to-ony relationship object will be stored
   * after the relationship owning object, i.e. when the relationship 
   * refers to the relationship owning object itself.
   * 
   * The one-to-many relationships are stored after storing the given object
   * and additionally the one-to-one relationship ids are set.
   * 
   * The database is queried through the function 'databaseIndependentQuery'
   * which will return a unified result between all databases.
   * 
   * @param queryFn 
   * @param classNameOrTable 
   * @param obj 
   * @param asDatabaseRow 
   * @param storedObjects 
   * @param relationshipPath 
   * @returns 
   */
  async store(
    queryFn: QueryFn, 
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    obj: any, 
    asDatabaseRow = false, 
    storedObjects: StoredObjects = new StoredObjects,
    relationshipPath: string = 'root'
  ): Promise<any> {

    let l = ormLog.mt('store')
    l.locationSeparator = ' > '
  
    if (relationshipPath != undefined) {
      l.location = [ relationshipPath ]
    }
    else {
      l.location = []
    }
  
    l.param('obj', obj)
    l.param('asDatabaseRow', asDatabaseRow)
    l.dev('storedObjects.rowEntries', storedObjects.entries)
  
    if (storedObjects.isContained(obj)) {
      l.lib('Row already stored. Returning...')
      return
    }

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }
  
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
  
        if (! storedObjects.isContained(manyToOneObj)) {
          l.lib('There is a relationship object and it was not stored yet')
  
          let storeFn
          if (! asDatabaseRow && relationship.otherTable.className in this.customStoreFunctions) {
            l.lib('Found custom store function')
            storeFn = this.customStoreFunctions[relationship.otherTable.className]
          }
          else {
            l.lib('Did not find custom store function')
            storeFn = this.store.bind(this)
          }
  
          l.calling('Storing it now...')
          
          let relationshipStoreInfo = await storeFn(
            queryFn, 
            relationship.otherTable, 
            obj[relationship.name], 
            asDatabaseRow,
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
            let l = ormLog.fn('afterStorageHandler')
            l.lib('Setting many-to-one id...')
            l.param('justStoredManyToOneObject', justStoredManyToOneObj)
            l.param('relationship.name', relationship.name)
  
            let row
            let justStoredManyToOneRow
            if (asDatabaseRow) {
              row = obj
              justStoredManyToOneRow = justStoredManyToOneObj
            }
            else {
              let reduced = {
                [relationship.otherId.name]: justStoredManyToOneObj[relationship.otherId.name]
              }
              
              l.lib('Converting reduced just stored object to a database row...', reduced)
              
              l.calling('Calling Table.instanceToRow...')
              justStoredManyToOneRow = table.instanceToRow(reduced, true)
              l.called('Called Table.instanceToRow...')

              l.lib('Converted reduced just stored object to row', justStoredManyToOneRow)
  
              reduced = this.objectTools.reduceToPrimaryKey(table, obj)
              l.lib('Converting reduced object to set the many-to-one id on to row', reduced)

              l.calling('Calling Table.instanceToRow...')
              row = table.instanceToRow(reduced, true)
              l.called('Called Table.instanceToRow...')
            }
  
            l.lib('Setting missing many-to-one id on row...', row)
  
            let query = sql.update(table.name)
  
            for (let column of table.primaryKey) {
              query.where(comparison(column.name, row[column.name]))
            }
  
            query.set(relationship.thisId.name, justStoredManyToOneRow[relationship.otherId.name])
  
            l.calling('Calling databaseIndependentQuery')
    
            let result
            try {
              result = await this.queryTools.databaseIndependentQuery(queryFn, query.sql(this.db), query.values()) as InsertUpdateDeleteResult
            }
            catch (e) {
              throw new Error(e as any)
            }
  
            l.called('Called databaseIndependentQuery...')
        
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
  
    let row
    if (asDatabaseRow) {
      l.lib('Given object should be treated as a database row')
      row = obj
    }
    else {
      l.lib('Given object should be treated as an instance. Converting to database row...')
      l.calling('Calling Table.instanceToRow...')
      row = table.instanceToRow(obj, true)
      l.called('Called Table.instanceToRow...')
    }
  
    l.lib('Determining if to store or to update the given row...', row)
    
    let doUpdate = await this.objectTools.isUpdate(table, queryFn, row, true)
  
    if (doUpdate) {
      if (this.objectTools.isAtLeastOneNotPrimaryKeyColumnSet(table, row, true)) {
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
          result = await this.queryTools.databaseIndependentQuery(queryFn, query.sql(this.db), query.values()) as InsertUpdateDeleteResult
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
        l.lib('Not updating the given row because there is no column set which does not belong to the primary key')
        
        for (let column of table.primaryKey) {
          storeInfo[column.name] = obj[column.name]
        }
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
        result = await this.queryTools.databaseIndependentQuery(queryFn, query.sql(this.db), query.values(), generatedPrimaryKey?.name) as InsertUpdateDeleteResult
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
            if (asDatabaseRow) {
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
              reduced = this.objectTools.reduceToPrimaryKey(table, oneToOneObj)
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
              result = await this.queryTools.databaseIndependentQuery(queryFn, query.sql(this.db), query.values()) as InsertUpdateDeleteResult
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
              
              let storeFn
              if (! asDatabaseRow && relationship.otherTable.className in this.customStoreFunctions) {
                l.lib('Found custom store function')
                storeFn = this.customStoreFunctions[relationship.otherTable.className]
              }
              else {
                l.lib('Did not find custom store function')
                storeFn = this.store.bind(this)
              }
  
              l.called('Storing the row...')
              let relationshipStoreInfo = await storeFn(
                queryFn, 
                relationship.otherTable, 
                oneToManyObj, 
                asDatabaseRow, 
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
                if (asDatabaseRow) {
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
                  reduced = this.objectTools.reduceToPrimaryKey(table, oneToManyObj)
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
                  result = await this.queryTools.databaseIndependentQuery(queryFn, query.sql(this.db), query.values()) as InsertUpdateDeleteResult
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

  /**
   * Deletes the given object.
   * 
   * If the primary key is not set it will throw an error.
   * 
   * The database is queried through the function 'databaseIndependentQuery'
   * which will return a unified result between all databases.
   * 
   * @param queryFn 
   * @param classNameOrTable 
   * @param obj 
   * @param asDatabaseRow 
   * @returns 
   */
  async delete(
    queryFn: QueryFn, 
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    obj: any, 
    asDatabaseRow = false
  ): Promise<any> {

    let l = ormLog.mt('delete')
    l.param('obj', obj)
    l.param('asDatabaseRow', asDatabaseRow)
  
    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    if (! this.objectTools.isPrimaryKeySet(table, obj)) {
      throw new Error('Could not delete object because the primary key is not set.')
    }
  
    let query = sql.deleteFrom(table.name)
    let deleteInfo: any = {}
  
    for (let column of table.primaryKey) {
      query.where(comparison(column.name, obj[column.getName(asDatabaseRow)]))
      deleteInfo[column.getName(asDatabaseRow)] = obj[column.getName(asDatabaseRow)]
    }
  
    let result
    try {
      result = await this.queryTools.databaseIndependentQuery(queryFn, query.sql(this.db), query.values()) as InsertUpdateDeleteResult
    }
    catch (e) {
      throw new Error(e as any)
    }
  
    if (result.affectedRows != 1) {
      throw new Error('Could not delete object.')
    }
  
    l.returning('Returning delete info...', deleteInfo)
    return deleteInfo
  }

  /**
   * 
   * @param queryFn 
   * @param classNameOrTable 
   * @param criteria 
   * @param asDatabaseCriteria 
   * @returns 
   */
  async load(
    queryFn: QueryFn, 
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    criteria: Criteria, 
    asDatabaseCriteria = false
  ): Promise<any[]> {

    let l = ormLog.mt('load')
    l.param('criteria', criteria)
    
    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    l.location = [ table.name ]

    l.calling('Calling knight-orm/query.ts > QueryTools.buildLoadQuery')
    let query = this.queryTools.buildLoadQuery(table, criteria, asDatabaseCriteria)
    l.called('Calling knight-orm/query.ts > QueryTools.buildLoadQuery')
    
    l.dev('Built SELECT query', query)
  
    l.lib('Querying database with given SQL string and values')
    let joinedRows
  
    try {
      l.calling('Calling knight-orm/query.ts > QueryTools.databaseIndependentQuery')
      joinedRows = await this.queryTools.databaseIndependentQuery(queryFn, query.sql(this.db), query.values()) as SelectResult
      l.called('Called knight-orm/query.ts > QueryTools.databaseIndependentQuery')
    }
    catch (e) {
      throw new Error(e as any)
    }

    l.dev('Received rows', joinedRows)
  
    let joinAlias = new JoinAlias(table)
  
    l.calling('Unjoining rows for criteria...')
    let objects = joinAlias.unjoinRows(joinedRows, criteria, asDatabaseCriteria)
    l.called('Unjoined objects for criteria...', criteria)
    l.dev('Unjoined objects', objects)
  
    l.calling('Calling \'knight-orm/criteria.ts CriteriaTools.determineRelationshipsToLoadSeparately\'')
    let relationshipsToLoad = this.criteriaTools.determineRelationshipsToLoadSeparately(table, objects, criteria)
    l.calling('Called \'knight-orm/criteria.ts CriteriaTools.determineRelationshipsToLoadSeparately\'')
  
    l.lib('Loading all relationships that need to be loaded separately...', Object.keys(relationshipsToLoad))
  
    for (let relationshipPath of Object.keys(relationshipsToLoad)) {
      l.lib('Loading relationships for path', relationshipPath)
  
      let relationshipToLoad = relationshipsToLoad[relationshipPath]
      
      let relationship = relationshipToLoad.relationship
      l.lib('Relationship table', relationship.table.name)
      l.lib('Relationship name', relationship.name)
      l.dev('Objects to load relationship objects for', relationshipToLoad.objs)
  
      let idsToLoad: any[] = []
      for (let obj of relationshipToLoad.objs) {
        if (obj[relationship.thisId.getName(asDatabaseCriteria)] !== undefined) {
          if (idsToLoad.indexOf(obj[relationship.thisId.getName(asDatabaseCriteria)]) == -1) {
            idsToLoad.push(obj[relationship.thisId.getName(asDatabaseCriteria)])
          }
        }
      }

      l.dev('Id\'s of these objects', idsToLoad)
  
      let criteria = {
        ...relationshipToLoad.relationshipCriteria
      }
  
      criteria[relationship.otherId.getName(asDatabaseCriteria)] = idsToLoad
  
      l.calling('Loading relationship objects with the following criteria', criteria)
      let loadedRelationships = await this.load(queryFn, table, criteria, asDatabaseCriteria)
      l.called('Loaded relationship rows for criteria', criteria)
      l.dev('Loaded relationship objects', loadedRelationships)
  
      l.lib('Attaching relationship objects...')
  
      for (let obj of relationshipToLoad.objs) {
        l.dev('Attaching relationship row', obj)
  
        if (relationship.oneToMany === true) {
          obj[relationship.name] = []
        }
        else {
          obj[relationship.name] = null
        }
  
        for (let loadedRelationship of loadedRelationships) {
          if (obj[relationship.thisId.getName(asDatabaseCriteria)] == loadedRelationship[relationship.otherId.getName(asDatabaseCriteria)]) {
            if (relationship.oneToMany === true) {
              l.dev('Pushing into array of one-to-many...', loadedRelationship)
              obj[relationship.name].push(loadedRelationship)
            }
            else {
              l.dev('Setting property of many-to-one..', loadedRelationship)
              obj[relationship.name] = loadedRelationship
            }
          }
        }
      }
    }
  
    l.returning('Returning objects...', objects)
    return objects
  }

  async count(
    queryFn: QueryFn, 
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    criteria: Criteria, 
    asDatabaseCriteria = false
  ): Promise<number> {

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    let query = this.queryTools.buildCriteriaCountQuery(table, criteria, asDatabaseCriteria)

    let rows
    try {
      rows = await this.queryTools.databaseIndependentQuery(queryFn, query.sql(this.db), query.values()) as SelectResult
    }
    catch (e) {
      throw new Error(e as any)
    }
  
    let count = rows[0].count
  
    try {
      parseInt(count)
    }
    catch (e) {
      throw new Error(e as any)
    }
    
    return count
  }

  async criteriaUpdate(
    queryFn: QueryFn, 
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    criteria: UpdateCriteria, 
    asDatabaseCriteria = false
  ): Promise<any> {

    let l = ormLog.mt('criteriaUpdate')
    l.param('criteria', criteria)
    l.param('asDatabaseCriteria', asDatabaseCriteria)
  
    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    let query = new Query
    query.update(table.name)
  
    for (let column of table.columns) {
      if (criteria[column.getName(asDatabaseCriteria)] !== undefined) {
        let value = criteria[column.getName(asDatabaseCriteria)]
        query.set(column.name, value)
      }
    }
  
    this.queryTools.addCriteria(table, query, criteria['@criteria'], asDatabaseCriteria)
  
    let sqlString = query.sql(this.db)
    let values = query.values()
  
    l.lib('SQL string', sqlString)
    l.lib('Values', values)
  
    let result
    try {
      result = await queryFn(sqlString, values)
    }
    catch (e) {
      throw new Error(e as any)
    }
    
    l.returning('Returning result...', result)
    return result
  }
  
  async criteriaDelete(
    queryFn: QueryFn, 
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    criteria: Criteria, 
    asDatabaseCriteria = false
  ): Promise<any> {

    let l = ormLog.mt('criteriaDelete')
    l.param('criteria', criteria)
    l.param('asDatabaseCriteria', asDatabaseCriteria)
    
    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    let query = new Query
    query.deleteFrom(table.name)
    this.queryTools.addCriteria(table, query, criteria, asDatabaseCriteria)
  
    let sqlString = query.sql(this.db)
    let values = query.values()
  
    l.lib('SQL string', sqlString)
    l.lib('Values', values)
  
    let result
    try {
      result = await queryFn(sqlString, values)
    }
    catch (e) {
      throw new Error(e as any)
    }
    
    l.returning('Returning result...', result)
    return result
  }
}
