import { Log } from 'knight-log'
import sql, { comparison } from 'knight-sql'
import { isUpdate } from '.'
import { databaseIndependentQuery, InsertUpdateDeleteResult } from './query'
import { checkSchema, getGeneratedPrimaryKeyColumn, getPrimaryKey, isPrimaryKeyColumn, Schema } from './Schema'

let log = new Log('knight-orm/orm.ts')

export interface StoreOptions {
  asDatabaseRow?: boolean
}

/**
 * 
 * @param schema 
 * @param tableName 
 * @param db 
 * @param queryFn 
 * @param row 
 * @param storedRows 
 */
export async function store(
      schema: Schema, 
      tableName: string,
      db: string,
      queryFn: (sqlString: string, values?: any[]) => Promise<any>,
      row: any,
      storedRows: StoredRows = new StoredRows(schema),
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

  l.param('tableName', tableName)
  l.param('db', db)
  l.param('row', row)
  l.dev('alreadyStoredRows', storedRows.rowEntries)

  checkSchema(schema, tableName)

  if (storedRows.isRowContained(row)) {
    l.lib('Row already stored. Returning...')
    return
  }

  let table = schema[tableName]
  let storeInfo: any = {}
  storedRows.setRowAboutToBeStored(row)

  if (table.relationships) {
    let relationshipNames = Object.keys(table.relationships)

    if (relationshipNames.length > 0) {
      l.lib('Storing missing many-to-one or one-to-one relationships first to be able to assign their id\'s before storing the actual row')

      l.location.push('')

      for (let relationshipName of relationshipNames) {
        l.location.pop()
        l.location.push(relationshipName)

        let relationship = table.relationships[relationshipName]

        if (relationship.manyToOne !== true) {
          l.lib('Relationship is not many-to-one nor one-to-one. Skipping...')
          continue
        }

        let manyToOneRow = row[relationshipName]

        if (manyToOneRow == undefined) {
          l.lib('There is not row set for this relationship. Skipping...')
          continue
        }

        if (typeof manyToOneRow != 'object') {
          l.lib('The associated row for the relationship is not of type object. Skipping...')
          continue
        }

        l.lib('Relationship', relationship)

        if (! storedRows.isRowContained(manyToOneRow)) {
          l.lib('There is a relationship row object and it was not stored yet')
          l.calling('Storing it now...')
          
          let relationshipStoreInfo = await store(
            schema, 
            relationship.otherTable, 
            db, 
            queryFn, 
            row[relationshipName], 
            storedRows, 
            relationshipPath != undefined ? relationshipPath + '.' + relationshipName : relationshipName
          )

          l.called('Returned from storing the relationship row...')

          l.lib(`Setting the many-to-one id one column using the stored relationship row -> ${relationship.thisId} =`, relationshipStoreInfo[relationship.otherId])
          row[relationship.thisId] = manyToOneRow[relationship.otherId]
          
          l.dev('Setting relationship store info', relationshipStoreInfo)
          storeInfo[relationshipName] = relationshipStoreInfo
        }

        else if (manyToOneRow[relationship.otherId] !== undefined) {
          l.lib(`Relationship row is about to be stored up the recursion chain but the needed id is already there. Setting it... ${relationship.thisId} = ${manyToOneRow[relationship.otherId]}`)
          row[relationship.thisId] = manyToOneRow[relationship.otherId]
        }

        else if (storedRows.isRowAboutToBeStored(manyToOneRow)) {
          l.lib('Row is about to be stored somewhere up the recursion chain. Adding handler which sets the id on the relationship owning row as soon as the relationship row is stored.')

          storedRows.addAfterStoredRowHandler(manyToOneRow, async (justStoredManyToOneRow: any) => {
            let l = log.fn('afterStoredRowHandler')
            l.param('justStoredRow', justStoredManyToOneRow)
            l.param('relationship', relationship)
  
            let query = sql.update(tableName)
  
            for (let column of getPrimaryKey(table)) {
              if (row[column] === undefined) {
                throw new Error('Some columns of primary are not set.')
              }
  
              query.where(comparison(column, row[column]))
            }
  
            query.set(relationship.thisId, justStoredManyToOneRow[relationship.otherId])
  
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
          throw new Error('Relationship row was already stored but it still does not contain the needed id for the many-to-one relationship.')
        }
      }

      l.location.pop()
    }
  }

  l.lib('Determining if to store or to update the given row...', row)
  
  let doUpdate = await isUpdate(schema, tableName, db, queryFn, row)

  if (doUpdate) {
    l.lib('Updating the given row...')

    let query = sql.update(tableName)

    for (let column of Object.keys(table.columns)) {
      if (isPrimaryKeyColumn(table, column)) {
        query.where(comparison(column, row[column]), 'AND')
      }
      else if (row[column] !== undefined) {
        query.value(column, row[column])
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

    for (let column of getPrimaryKey(table)) {
      storeInfo[column] = row[column]
    }
  }

  else {
    l.lib('Inserting the given row...')

    let query = sql.insertInto(tableName)

    for (let column of Object.keys(table.columns)) {
      if (row[column] !== undefined) {
        query.value(column, row[column])
      }
    }

    let generatedPrimaryKey = getGeneratedPrimaryKeyColumn(table)

    let result
    try {
      result = await databaseIndependentQuery(db, queryFn, query.sql(db), query.values(), generatedPrimaryKey) as InsertUpdateDeleteResult
    }
    catch (e) {
      throw new Error(e as any)
    }

    if (result.affectedRows != 1) {
      throw new Error(`Inserted ${result.affectedRows} rows for ${relationshipPath}. Should have been exactly one row.`)
    }

    storeInfo['@update'] = false

    for (let column of getPrimaryKey(table)) {
      storeInfo[column] = row[column]
    }

    if (generatedPrimaryKey) {
      l.dev(`Setting generated primary key on row: ${generatedPrimaryKey} = ${result.insertId}`)
      row[generatedPrimaryKey] = result.insertId
      l.dev(`Setting generated primary key on storage information: ${generatedPrimaryKey} = ${result.insertId}`)
      storeInfo[generatedPrimaryKey] = result.insertId
    }
  }

  l.lib('Storage information', storeInfo)
  l.calling('Triggering actions that can be down now after this row was stored...')

  try {
    await storedRows.setRowStored(row)
  }
  catch (e) {
    throw new Error(e as any)
  }

  l.called('Triggered actions after row was stored')

  if (table.relationships) {
    let relationshipNames = Object.keys(table.relationships)

    if (relationshipNames.length > 0) {
      l.lib('Storing one-to-many relationship rows and setting one-to-one back references...', relationshipNames)

      l.location.push('')

      for (let relationshipName of relationshipNames) {
        l.location.pop()
        l.location.push(relationshipName)
        
        let relationship = table.relationships[relationshipName]
        let otherTable = schema[relationship.otherTable]

        if (relationship.manyToOne && relationship.otherRelationship) {
          let otherRelationship = otherTable.relationships![relationship.otherRelationship]
          let oneToOneRow = row[relationshipName]

          if (oneToOneRow == undefined) {
            l.lib('There is no row set for this one-to-one relationship. Skipping...')
            continue
          }
  
          if (typeof oneToOneRow != 'object') {
            l.lib('The associated row value for the relationship is not of type object. Skipping...', oneToOneRow)
            continue
          }

          l.lib('Relationship', relationship)

          if (! storedRows.isRowContained(oneToOneRow)) {
            throw new Error('One-to-one row is neither to be stored nor stored. This is an invalid state because any many-to-one row should have already been processed. Please contact the library programmer.')
          }

          else if (storedRows.isRowAboutToBeStored(oneToOneRow)) {
            l.lib('One-to-one row is about to be stored', oneToOneRow)
            l.lib(`Setting its many-to-one relationship id which references back -> ${otherRelationship.thisId} =`, row[otherRelationship.otherId])
            oneToOneRow[otherRelationship.thisId] = row[otherRelationship.otherId]
          }

          else {
            l.lib('One-to-one row was already stored', oneToOneRow)
            l.lib(`Setting its many-to-one relationship id which references back -> ${otherRelationship.thisId} =`, row[otherRelationship.otherId])

            let query = sql.update(relationship.otherTable)
      
            for (let column of getPrimaryKey(schema[relationship.otherTable])) {
              if (row[column] === undefined) {
                throw new Error('Some columns of primary are not set.')
              }
  
              query.where(comparison(column, oneToOneRow[column]))
            }
  
            query.set(otherRelationship.thisId, row[otherRelationship.otherId])
  
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
          let oneToManyArray = row[relationshipName]

          if (oneToManyArray == undefined) {
            l.lib('There is no row set for this one-to-one relationship. Skipping...')
            continue
          }

          if (! (oneToManyArray instanceof Array)) {
            l.lib('Relationship is one-to-many but given relationship object is not of type array. Skipping...', oneToManyArray)
            continue
          }

          if (oneToManyArray.length == 0) {
            l.lib('One-to-many relationship is an array but it has 0 entries. Skipping...')
            continue
          }

          l.lib('One-to-many relationship is an array. Iterating through every one-to-many row...')

          for (let oneToManyRow of oneToManyArray) {
            if (! storedRows.isRowContained(oneToManyRow)) {
              l.lib('One-to-many row was not stored yet', oneToManyRow)
              
              l.lib(`Setting many-to-one relationship id on the one-to-many row: ${relationship.otherId} = ${row[relationship.thisId]}`)
              oneToManyRow[relationship.otherId] = row[relationship.thisId]
              
              l.called('Storing the row...')
              let relationshipStoreInfo = await store(
                schema, 
                relationship.otherTable, 
                db, 
                queryFn, 
                oneToManyRow, 
                storedRows, 
                relationshipPath != undefined ? relationshipPath + '.' + relationshipName : relationshipName
              )
    
              l.called('Returned from storing relationship row...')
              
              if (relationshipStoreInfo) {
                if (storeInfo[relationshipName] == undefined) {
                  storeInfo[relationshipName] = []
                }
    
                storeInfo[relationshipName].push(relationshipStoreInfo)
              }
            }
    
            else if (storedRows.isRowAboutToBeStored(oneToManyRow)) {
              l.lib('One-to-many row is about to be stored up the recursion chain', oneToManyRow)

              if (oneToManyRow[relationship.otherId] === undefined) {
                l.lib(`The many-to-one id referencing this one-to-many row is not set. Setting it: ${relationship.otherId} =`, row[relationship.thisId])
                oneToManyRow[relationship.otherId] = row[relationship.thisId]  
              }
              else {
                l.lib('The many-to-one id referencing back to this one-to-many row is already set which means that this row is part of a many-to-many relationship')
              }
            }
    
            else {
              l.lib('One-to-many row was already stored', oneToManyRow)

              if (oneToManyRow[relationship.otherId] === undefined) {
                l.lib(`The many-to-one id referencing this one-to-many row is not set. Setting it in the database: ${relationship.otherId} =`, row[relationship.thisId])
    
                let query = sql.update(relationship.otherTable)
        
                for (let column of getPrimaryKey(otherTable)) {
                  if (row[column] === undefined) {
                    throw new Error('Could not set the many-to-one id on one-to-many row because not all primary key columns are set. Please contact the library programmer.')
                  }
      
                  query.where(comparison(column, oneToManyRow[column]))
                }
      
                query.set(relationship.otherId, row[relationship.thisId])
      
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
                l.lib('The many-to-one id referencing back to this one-to-many row is already set which means that this row is part of a many-to-many relationship')
              }
            }    
          }
        }
      }

      l.location.pop()
    }
  }
    
  l.returning('Returning storage information...', storeInfo)
  return storeInfo
}

export interface RowEntry {
  stored: boolean,
  row: any,
  afterSettingResultHandlers: ((result: any) => Promise<void>)[]
}

let storedRowsLog = log.cls('StoredRows')

export class StoredRows {
  schema: Schema
  rowEntries: RowEntry[] = []

  constructor(schema: Schema) {
    this.schema = schema
  }

  setRowAboutToBeStored(row: any) {
    if (! this.isRowContained(row)) {
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

  isRowContained(row: any): boolean {
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

  addAfterStoredRowHandler(row: any, handler: (justStoredRow: any) => Promise<void>) {
    let rowEntry = this.getRowEntry(row)

    if (rowEntry == undefined) {
      throw new Error('Could not addAfterStoredRowHandler because the given row object is was not added yet. Use \'setRowAboutToBeStored\' to do so.')
    }

    rowEntry.afterSettingResultHandlers.push(handler)
  }
}
