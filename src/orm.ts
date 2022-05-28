import { Change } from 'knight-change'
import { Criteria } from 'knight-criteria'
import { Log } from 'knight-log'
import sql, { comparison, Query } from 'knight-sql'
import { CriteriaTools } from './criteria'
import { Alias } from './alias'
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

export interface UpdateCriteria {
  [column: string]: any
  '@criteria': Criteria
}

let ormLog = log.cls('Orm')

export class Orm {
  schema: Schema
  db: string

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
  ): Promise<Change[]> {

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
      return []
    }

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }
  
    let changes: Change[] = []
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
  
          l.calling('Storing it now...')
          
          let relationshipChanges = await this.store(
            queryFn, 
            relationship.otherTable, 
            obj[relationship.name], 
            asDatabaseRow,
            storedObjects, 
            relationshipPath != undefined ? relationshipPath + '.' + relationship.name : relationship.name
          )
  
          l.called('Returned from storing the relationship object...')
  
          l.lib(`Setting the many-to-one id using the stored relationship object: ${relationship.thisId.getName(asDatabaseRow)} =`, manyToOneObj[relationship.otherId.getName(asDatabaseRow)])
          obj[relationship.thisId.getName(asDatabaseRow)] = manyToOneObj[relationship.otherId.getName(asDatabaseRow)]
          
          l.dev('Adding changes made in the relationship', relationshipChanges)
          changes.push(...relationshipChanges)
        }
  
        else if (manyToOneObj[relationship.otherId.getName(asDatabaseRow)] !== undefined) {
          l.lib(`Relationship object is about to be stored up the recursion chain but the needed id is already there. Setting it... ${relationship.thisId.getName(asDatabaseRow)} = ${manyToOneObj[relationship.otherId.getName(asDatabaseRow)]}`)
          obj[relationship.thisId.getName(asDatabaseRow)] = manyToOneObj[relationship.otherId.getName(asDatabaseRow)]
        }
  
        else if (storedObjects.isAboutToBeStored(manyToOneObj)) {
          l.lib('Object is about to be stored somewhere up the recursion chain. Adding handler which sets the id on the relationship owning object as soon as the relationship object is stored.')
  
          storedObjects.addAfterStorageHandler(manyToOneObj, async (justStoredManyToOneObj: any) => {
            let l = log.fn('afterStorageHandler')
            l.lib('Setting many-to-one id...')
            l.param('justStoredManyToOneObject', justStoredManyToOneObj)
            l.param('relationship.name', relationship.name)
  
            let row
            let manyToOneRow

            if (asDatabaseRow) {
              row = obj
              manyToOneRow = justStoredManyToOneObj
            }
            else {
              let reducedManyToOneObj = {
                [relationship.otherId.getName(asDatabaseRow)]: justStoredManyToOneObj[relationship.otherId.getName(asDatabaseRow)]
              }
              
              l.lib('Converting reduced just stored object to a database row...', reducedManyToOneObj)
              
              l.calling('Calling Table.instanceToRow...')
              manyToOneRow = relationship.otherTable.instanceToRow(reducedManyToOneObj, true)
              l.called('Called Table.instanceToRow...')

              l.lib('Converted reduced just stored object to row', reducedManyToOneObj)
  
              let reducedObj = this.objectTools.reduceToPrimaryKey(table, obj)
              l.lib('Converting reduced object to set the many-to-one id on to row', reducedObj)

              l.calling('Calling Table.instanceToRow...')
              row = table.instanceToRow(reducedObj, true)
              l.called('Called Table.instanceToRow...')
            }
  
            l.lib('Setting missing many-to-one id on row...', row)
  
            let query = sql.update(table.name)
  
            for (let column of table.primaryKey) {
              query.where(comparison(column.name, row[column.name]))
            }
  
            query.set(relationship.thisId.name, manyToOneRow[relationship.otherId.name])
  
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

            obj[relationship.thisId.getName(asDatabaseRow)] = justStoredManyToOneObj[relationship.otherId.getName(asDatabaseRow)]

            let entity: any = {
              [relationship.thisId.getName(asDatabaseRow)]: justStoredManyToOneObj[relationship.otherId.getName()]
            }

            for (let column of table.primaryKey) {
              entity[column.getName()] = obj[column.getName(asDatabaseRow)]
            }

            let change = new Change(asDatabaseRow ? table.name : table.className, entity, 'update', [ relationship.thisId.getName(asDatabaseRow) ])
            l.lib('Add change to result', change)
            changes.push(change)
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
        l.lib('Updating...')
        let dbResult: any

        l.lib('Loading the row before the update')

        let selectQuery = sql.select('*').from(table.name)
        for (let column of table.primaryKey) {
          selectQuery.where(comparison(column.name, row[column.name]), 'AND')
        }

        try {
          dbResult = await this.queryTools.databaseIndependentQuery(queryFn, selectQuery.sql(this.db), selectQuery.values()) as SelectResult
        }
        catch (e) {
          throw new Error(e as any)
        }

        if (dbResult.length != 1) {
          throw new Error(`The row count was ${dbResult.length} instead of exactly 1 while loading the row before updating it.`)
        }

        let rowBefore = dbResult[0]

        l.lib('Updating row')
  
        let updateQuery = sql.update(table.name)
    
        for (let column of table.columns) {
          if (column.primaryKey) {
            updateQuery.where(comparison(column.name, row[column.name]), 'AND')
          }
          else if (row[column.name] !== undefined) {
            updateQuery.set(column.name, row[column.name])
          }
        }

        let sqlString = updateQuery.sql(this.db)
        l.lib('Update SQL query string', sqlString)
        let values = updateQuery.values()
        l.lib('Update SQL query string parameter', values)
    
        try {
          dbResult = await this.queryTools.databaseIndependentQuery(queryFn, sqlString, values) as InsertUpdateDeleteResult
        }
        catch (e) {
          throw new Error(e as any)
        }
      
        if (dbResult.affectedRows != 1) {
          throw new Error(`Updated ${dbResult.affectedRows} rows for ${relationshipPath}. Should have been exactly one row. Please enable logging for more information.`)
        }

        l.lib('Loading the row after the update')

        try {
          dbResult = await this.queryTools.databaseIndependentQuery(queryFn, selectQuery.sql(this.db), selectQuery.values()) as SelectResult
        }
        catch (e) {
          throw new Error(e as any)
        }

        if (dbResult.length != 1) {
          throw new Error(`The row count was ${dbResult.length} instead of exactly 1 while loading the row after updating it.`)
        }

        let rowAfter = dbResult[0]
        let objAfter = asDatabaseRow ? rowAfter : table.rowToInstance(rowAfter)
        let props: string[] = []
        let entity: any = {}

        for (let column of table.columns) {
          obj[column.getName(asDatabaseRow)] = objAfter[column.getName(asDatabaseRow)]

          if (rowBefore[column.name] !== undefined && rowBefore[column.name] !== rowAfter[column.name]) {
            entity[column.getName(asDatabaseRow)] = objAfter[column.getName(asDatabaseRow)]
            props.push(column.getName(asDatabaseRow))
          }
        }

        for (let column of table.primaryKey) {
          entity[column.getName(asDatabaseRow)] = objAfter[column.getName(asDatabaseRow)]
        }
    
        let change = new Change(asDatabaseRow? table.name : table.className, entity, 'update', props)
        l.lib('Add change to result', change)
        changes.push(change)
      }
      else {
        l.lib('Not updating the given row because there is no column set which does not belong to the primary key')

        let selectQuery = sql.select('*').from(table.name)
        for (let column of table.primaryKey) {
          selectQuery.where(comparison(column.name, row[column.name]), 'AND')
        }

        let dbResult
        try {
          dbResult = await this.queryTools.databaseIndependentQuery(queryFn, selectQuery.sql(this.db), selectQuery.values()) as SelectResult
        }
        catch (e) {
          throw new Error(e as any)
        }

        if (dbResult.length != 1) {
          throw new Error(`The row count was ${dbResult.length} instead of exactly 1 while loading the row after updating it.`)
        }

        let currentRow = dbResult[0]
        let currentObj = asDatabaseRow ? currentRow : table.rowToInstance(currentRow)

        for (let column of table.columns) {
          obj[column.getName(asDatabaseRow)] = currentObj[column.getName(asDatabaseRow)]
        }
      }
    }
  
    else {
      l.lib('Inserting the given row...')
  
      let insertQuery = sql.insertInto(table.name)
  
      for (let column of table.columns) {
        if (obj[column.getName(asDatabaseRow)] !== undefined) {
          insertQuery.value(column.name, row[column.name])
        }
      }

      let sqlString = insertQuery.sql(this.db)
      l.lib('Update SQL query string', sqlString)
      let values = insertQuery.values()
      l.lib('Update SQL query string parameter', values)

      let generatedPrimaryKey = table.generatedPrimaryKey
  
      let dbResult: any
      try {
        dbResult = await this.queryTools.databaseIndependentQuery(queryFn, sqlString, values, generatedPrimaryKey?.name) as InsertUpdateDeleteResult
      }
      catch (e) {
        throw new Error(e as any)
      }

      if (dbResult.affectedRows != 1) {
        throw new Error(`Inserted ${dbResult.affectedRows} rows for ${relationshipPath}. Should have been exactly one row.`)
      }

      if (generatedPrimaryKey) {
        l.dev(`Setting generated primary key on row: ${generatedPrimaryKey.name} = ${dbResult.insertId}`)
        row[generatedPrimaryKey.name] = dbResult.insertId
      }

      l.lib('Loading the row after the insert')
  
      let selectQuery = sql.select('*').from(table.name)
      for (let column of table.primaryKey) {
        selectQuery.where(comparison(column.name, row[column.name]), 'AND')
      }

      try {
        dbResult = await this.queryTools.databaseIndependentQuery(queryFn, selectQuery.sql(this.db), selectQuery.values()) as SelectResult
      }
      catch (e) {
        throw new Error(e as any)
      }

      if (dbResult.length != 1) {
        throw new Error(`The row count was ${dbResult.length} instead of exactly 1 while loading the row after inserting it.`)
      }

      let objAfter = asDatabaseRow ? dbResult[0] : table.rowToInstance(dbResult[0])
      let entity: any = {}

      for (let column of table.columns) {
        entity[column.getName(asDatabaseRow)] = objAfter[column.getName(asDatabaseRow)]
        obj[column.getName(asDatabaseRow)] = objAfter[column.getName(asDatabaseRow)]
      }
  
      let change = new Change(asDatabaseRow ? table.name : table.className, entity, asDatabaseRow ? 'insert' : 'create')
      l.lib('Add change to result', change)
      changes.push(change)
    }
  
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
  
            let row
            let oneToOneRow

            if (asDatabaseRow) {
              row = obj
              oneToOneRow = oneToOneObj
              l.lib('Given object should be treated as a database row')
            }
            else {
              let reducedObj = {
                [otherRelationship.otherId.getName(asDatabaseRow)]: obj[otherRelationship.otherId.getName(asDatabaseRow)]
              }
              l.lib('Converting instance to row on reduced object', reducedObj)
              l.calling('Calling Table.instanceToRow...')
              row = table.instanceToRow(reducedObj, true)
              l.called('Called Table.instanceToRow...')
              l.lib('Converted reduced row', row)
  
              let reducedOneToOneObj = this.objectTools.reduceToPrimaryKey(table, oneToOneObj)
              l.lib('Converting reduced one-to-one instance to row', reducedOneToOneObj)
              l.calling('Calling Table.instanceToRow...')
              oneToOneRow = otherTable.instanceToRow(reducedOneToOneObj, true)
              l.called('Called Table.instanceToRow...')
              l.lib('Converted reduced one-to-one row', row)
            }
  
            l.lib('Updating row...', row)
  
            let query = sql.update(otherTable.name)
      
            for (let column of otherTable.primaryKey) {
              if (row[column.name] === undefined) {
                throw new Error('Some columns of the primary key are not set.')
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

            oneToOneObj[otherRelationship.thisId.getName(asDatabaseRow)] = obj[otherRelationship.otherId.getName(asDatabaseRow)]

            let entity: any = {
              [otherRelationship.thisId.getName(asDatabaseRow)]: obj[otherRelationship.otherId.getName(asDatabaseRow)]
            }

            for (let column of otherTable.primaryKey) {
              entity[column.getName()] = oneToOneObj[column.getName(asDatabaseRow)]
            }

            let change = new Change(asDatabaseRow ? otherTable.name : otherTable.className, entity, 'update', [ otherRelationship.thisId.getName(asDatabaseRow) ])
            l.lib('Add change to result', change)
            changes.push(change)
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
                
              l.calling('Storing the row...')
              let relationshipChanges = await this.store(
                queryFn, 
                relationship.otherTable, 
                oneToManyObj, 
                asDatabaseRow, 
                storedObjects, 
                relationshipPath != undefined ? relationshipPath + '.' + relationship.name : relationship.name
              )
    
              l.called('Returned from storing relationship row...')              
              changes.push(...relationshipChanges)
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
  
              if (oneToManyObj[relationship.otherId.getName(asDatabaseRow)] == null) {
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
                  let reducedObj = {
                    [relationship.thisId.name]: obj[relationship.thisId.name]
                  }
                  row = table.instanceToRow(reducedObj, true)
                  l.called('Called Table.instanceToRow...')
      
                  l.lib('Converting one-to-many instance to row')
                  l.calling('Calling Table.instanceToRow...')
                  let reducedOneToManyObj = this.objectTools.reduceToPrimaryKey(table, oneToManyObj)
                  oneToManyRow = table.instanceToRow(reducedOneToManyObj, true)
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

                oneToManyObj[relationship.otherId.getName(asDatabaseRow)] = obj[relationship.thisId.getName(asDatabaseRow)]

                let entity: any = {
                  [relationship.otherId.getName(asDatabaseRow)]: obj[relationship.thisId.getName(asDatabaseRow)]
                }
    
                for (let column of otherTable.primaryKey) {
                  entity[column.getName()] = oneToManyObj[column.getName(asDatabaseRow)]
                }
    
                let change = new Change(asDatabaseRow ? otherTable.name : otherTable.className, entity, 'update', [ relationship.otherId.getName(asDatabaseRow) ])
                l.lib('Add change to result', change)
                changes.push(change)    
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
      
    l.returning('Returning changes...', changes)
    return changes
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
  ): Promise<Change> {

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

    let row = asDatabaseRow ? obj : table.instanceToRow(obj, true)

    l.lib('Loading the row before the update')

    let selectQuery = sql.select('*').from(table.name)
    for (let column of table.primaryKey) {
      selectQuery.where(comparison(column.name, row[column.name]), 'AND')
    }

    let dbResult
    try {
      dbResult = await this.queryTools.databaseIndependentQuery(queryFn, selectQuery.sql(this.db), selectQuery.values()) as SelectResult
    }
    catch (e) {
      throw new Error(e as any)
    }

    if (dbResult.length != 1) {
      throw new Error(`The row count was ${dbResult.length} instead of exactly 1 while loading the row before updating it.`)
    }

    let rowBefore = dbResult[0]
    let objBefore = asDatabaseRow ? rowBefore : table.rowToInstance(rowBefore)
  
    let query = sql.deleteFrom(table.name)
  
    for (let column of table.primaryKey) {
      query.where(comparison(column.name, row[column.name]))
    }

    let sqlString = query.sql(this.db)
    l.dev('Update SQL query string', sqlString)
    let values = query.values()
    l.dev('Update SQL query string parameter', values)
  
    try {
      dbResult = await this.queryTools.databaseIndependentQuery(queryFn, sqlString, values) as InsertUpdateDeleteResult
    }
    catch (e) {
      throw new Error(e as any)
    }
  
    if (dbResult.affectedRows != 1) {
      throw new Error('Could not delete object.')
    }
  
    let change = new Change(asDatabaseRow ? table.name : table.className, objBefore, 'delete')

    l.returning('Returning change...', change)
    return change
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
  
    l.lib('Querying database with given SQL query string and values')
    
    let sqlString = query.sql(this.db)
    l.lib('SQL query string', sqlString)
    let values = query.values()
    l.lib('SQL query string parameter', values)
    
    let joinedRows
  
    try {
      l.calling('Calling knight-orm/query.ts > QueryTools.databaseIndependentQuery')
      joinedRows = await this.queryTools.databaseIndependentQuery(queryFn, sqlString, values) as SelectResult
      l.called('Called knight-orm/query.ts > QueryTools.databaseIndependentQuery')
    }
    catch (e) {
      throw new Error(e as any)
    }

    l.dev('Received rows', joinedRows)
  
    let alias = new Alias(table)
  
    l.calling('Unjoining rows for criteria...')
    let objects = alias.unjoinRows(joinedRows, criteria, asDatabaseCriteria)
    l.called('Unjoined objects for criteria...', criteria)
    l.dev('Unjoined objects', objects)
  
    l.calling('Calling \'knight-orm/criteria.ts > CriteriaTools.determineRelationshipsToLoadSeparately\'')
    let relationshipsToLoad = this.criteriaTools.determineRelationshipsToLoadSeparately(table, objects, criteria)
    l.calling('Called \'knight-orm/criteria.ts > CriteriaTools.determineRelationshipsToLoadSeparately\'')
  
    l.lib('Loading all relationships that need to be loaded separately...', Object.keys(relationshipsToLoad))
  
    for (let relationshipPath of Object.keys(relationshipsToLoad)) {
      l.lib('Loading relationships for path', relationshipPath)
  
      let relationshipToLoad = relationshipsToLoad[relationshipPath]
      
      let relationship = relationshipToLoad.relationship
      l.lib('Relationship name', relationship.name)
      l.lib('Relationship table', relationship.otherTable.name)
      l.dev('Objects to load relationship objects for', relationshipToLoad.objs)
  
      let idsToLoad: any[] = []
      for (let obj of relationshipToLoad.objs) {
        if (obj[relationship.thisId.getName(asDatabaseCriteria)] != null) {
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
      let loadedRelationships = await this.load(queryFn, relationship.otherTable, criteria, asDatabaseCriteria)
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
