import { Criteria } from 'knight-criteria'
import { Log } from 'knight-log'
import sql, { comparison, Query } from 'knight-sql'
import { checkSchema, getGeneratedPrimaryKeyColumn, getNotGeneratedPrimaryKeyColumns, getPrimaryKey, isGeneratedPrimaryKeyColumn, isPrimaryKeyColumn } from '.'
import { UpdateCriteria } from './criteriaTools'
import { addCriteria, buildSelectQuery } from './queryTools'
import { areAllNotGeneratedPrimaryKeyColumnsSet, determineRelationshipsToLoad, unjoinRows } from './rowTools'
import { Schema } from './Schema'
import { StoredRows } from './util'

let log = new Log('knight-orm/isud.ts')

type InsertUpdateDeleteResult = {
  affectedRows: number
  insertId?: number
}

type SelectResult = any[]

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
      if (! ('affectedRows' in dbResult) || typeof dbResult.rowCount != 'number' || isNaN(dbResult.rowCount)) {
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

export async function isUpdate(
  schema: Schema,
  tableName: string,
  db: string,
  queryFn: (sqlString: string, values?: any[]) => Promise<any>,
  row: any
): Promise<boolean> {
  
  let l = log.fn('isUpdate')
  l.param('tableName', tableName)
  l.param('db', db)
  l.param('row', row)

  checkSchema(schema, tableName)
  let table = schema[tableName]

  if (! areAllNotGeneratedPrimaryKeyColumnsSet(table, row)) {
    throw new Error(`At least one not generated primary key column (${getNotGeneratedPrimaryKeyColumns(table).join(', ')}) is not set. Enable logging for more details.`)
  }

  let hasNotGeneratedPrimaryKeys = false
  let generatedPrimaryKeyCount = 0
  let generatedPrimaryKeyIsNull = true
  let generatedPrimaryKeyIsNotNull = true

  for (let column of getPrimaryKey(table)) {
    if (isGeneratedPrimaryKeyColumn(table, column)) {
      generatedPrimaryKeyCount++

      if (row[column] == null) {
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

  if (generatedPrimaryKeyCount > 1) {
    throw new Error(`The table ${tableName} has more than one generated primary key which is not valid.`)
  }

  if (generatedPrimaryKeyCount == 1 && ! generatedPrimaryKeyIsNull && ! generatedPrimaryKeyIsNotNull) {
    throw new Error('There is a generated primary key which are null and generated primary keys which are not null. This is an inconsistent set of column values. Cannot determine if row is to be inserted or to be updated. Please enable logging for more details.')
  }

  if ((generatedPrimaryKeyCount == 1 && generatedPrimaryKeyIsNotNull || ! generatedPrimaryKeyCount) && hasNotGeneratedPrimaryKeys) {
    l.lib('The row has not generated primary key columns. Determining if the row was already inserted.')
    
    let query = sql.select('*').from(tableName)

    for (let column of getPrimaryKey(table)) {
      query.where(comparison(column, row[column]), 'AND')
    }

    let rows
    try {
      rows = await databaseIndependentQuery(db, queryFn, query.sql(db), query.values()) as SelectResult
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

export async function select(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: Criteria): Promise<any[]> {
  let l = log.fn('select')
  l.location = [ tableName ]
  l.param('criteria', criteria)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = buildSelectQuery(schema, tableName, criteria)
  l.dev('Built SELECT query', query)

  let sqlString = query.sql(db)
  let values = query.values()

  l.lib('SQL string', sqlString)
  l.lib('Values', values)

  l.lib('Querying database with given SQL string and values...')
  let joinedRows = await queryFn(sqlString, values)
  l.dev('Received rows', joinedRows)

  l.calling('Unjoining rows for criteria...')
  let rows = unjoinRows(schema, tableName, joinedRows, criteria, tableName + '__')
  l.called('Unjoined rows for criteria...', criteria)
  l.dev('Unjoined rows', rows)

  l.calling('Determing relationships to load...')
  let relationshipsToLoad = determineRelationshipsToLoad(schema, tableName, rows, criteria)
  l.called('Determined relationships to load for criteria...', criteria)

  l.lib('Loading all relationships that need to be loaded in a seperate query...', Object.keys(relationshipsToLoad))

  for (let relationshipPath of Object.keys(relationshipsToLoad)) {
    l.lib('Loading relationships for path', relationshipPath)

    let relationshipToLoad = relationshipsToLoad[relationshipPath]
    
    let relationshipTable = schema[relationshipToLoad.tableName]
    l.lib('Relationship table', relationshipTable)
    l.lib('Relationship name', relationshipToLoad.relationshipName)

    if (relationshipTable == undefined) {
      throw new Error('Table not contained in schema: ' + relationshipToLoad.tableName)
    }

    let relationship = relationshipTable.relationships ? relationshipTable.relationships[relationshipToLoad.relationshipName] : undefined
    if (relationship == undefined) {
      throw new Error(`Relationship '${relationshipToLoad.relationshipName}' not contained table '${relationshipToLoad.tableName}'`)
    }

    let idsToLoad: any[] = []
    for (let row of relationshipToLoad.rows) {
      if (row[relationship.thisId] !== undefined) {
        if (idsToLoad.indexOf(row[relationship.thisId]) == -1) {
          idsToLoad.push(row[relationship.thisId])
        }
      }
    }

    let criteria = {
      ...relationshipToLoad.relationshipCriteria
    }

    criteria[relationship.otherId] = idsToLoad

    l.calling('Loading relationship rows with the following criteria', criteria)
    let loadedRelationships = await select(schema, relationship.otherTable, db, queryFn, criteria)
    l.called('Loaded relationship rows for criteria', criteria)
    l.dev('Loaded relationship rows', loadedRelationships)

    l.lib('Attaching relationship rows...')

    for (let row of relationshipToLoad.rows) {
      l.dev('Attaching relationship row', row)

      if (relationship.oneToMany === true) {
        row[relationshipToLoad.relationshipName] = []
      }
      else {
        row[relationshipToLoad.relationshipName] = null
      }

      for (let loadedRelationship of loadedRelationships) {
        if (row[relationship.thisId] == loadedRelationship[relationship.otherId]) {
          if (relationship.oneToMany === true) {
            l.dev('Pushing into array of one-to-many...', loadedRelationship)
            row[relationshipToLoad.relationshipName].push(loadedRelationship)
          }
          else {
            l.dev('Setting property of many-to-one..', loadedRelationship)
            row[relationshipToLoad.relationshipName] = loadedRelationship
          }
        }
      }
    }
  }

  l.returning('Returning rows...', rows)
  return rows
}

export async function update(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: UpdateCriteria): Promise<any[]> {
  let l = log.fn('update')
  l.param('tableName', tableName)
  l.param('criteria', criteria)

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = new Query
  query.update(tableName)

  for (let column of Object.keys(table.columns)) {
    if (criteria[column] !== undefined) {
      let value = criteria[column]
      query.set(column, value)
    }
  }

  addCriteria(schema, tableName, query, criteria['@criteria'])

  if (db == 'postgres') {
    query.returning('*')
  }

  let sqlString = query.sql(db)
  let values = query.values()

  l.lib('SQL string', sqlString)
  l.lib('Values', values)

  let updatedRows = await queryFn(sqlString, values)
  
  l.returning('Returning updated rows...', updatedRows)
  return updatedRows
}

export async function delete_(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: Criteria): Promise<any[]> {
  let l = log.fn('delete_')
  l.param('tableName', tableName)
  l.param('criteria', criteria)

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = new Query
  query.deleteFrom(tableName)
  addCriteria(schema, tableName, query, criteria)

  if (db == 'postgres') {
    query.returning('*')
  }

  let sqlString = query.sql(db)
  let values = query.values()

  l.lib('SQL string', sqlString)
  l.lib('Values', values)

  let deletedRows = await queryFn(sqlString, values)
  
  l.returning('Returning deleted rows...', deletedRows)
  return deletedRows
}