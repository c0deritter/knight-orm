import { Criteria } from 'knight-criteria'
import { Log } from 'knight-log'
import sql, { comparison, Query } from 'knight-sql'
import { getGeneratedPrimaryKeyColumn, getNotGeneratedPrimaryKeyColumns, getPrimaryKey, isGeneratedPrimaryKeyColumn, isPrimaryKeyColumn } from '.'
import { UpdateCriteria } from './criteriaTools'
import { addCriteria, buildSelectQuery } from './queryTools'
import { areAllNotGeneratedPrimaryKeyColumnsSet, determineRelationshipsToLoad, unjoinRows } from './rowTools'
import { getCorrespondingManyToOne, isForeignKey, Relationship, Schema } from './Schema'
import { StoredRows } from './util'

let log = new Log('knight-orm/isud.ts', 'lib')

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
  
      l.lib('Returning rows of SELECT', dbResult.rows)
      return dbResult.rows as SelectResult
    }
  
    if (db == 'mysql' || db == 'maria') {
      if (! (dbResult instanceof Array)) {
        throw new Error('Result returned by MySQL was not any array. Enable logging for more information.')
      }
  
      l.lib('Returning rows of SELECT', dbResult)
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

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

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
      l.returning('The row was already inserted. Returning true...')
    }
    else {
      l.returning('The row was not already inserted. Returning false...')
    }

    return alreadyInserted
  }

  if (generatedPrimaryKeyCount == 1 && generatedPrimaryKeyIsNotNull) {
    l.returning('The row does not have not generated primary key columns and all generated primary key columns are not null. Returning true...')
  }
  else {
    l.returning('The row does not have not generated primary key columns and all generated primary key columns are null. Returning false...')
  }

  return generatedPrimaryKeyCount == 1 && generatedPrimaryKeyIsNotNull
}

/**
 * At first it goes through all columns which contain an id of a many-to-one relationship
 * and it tries to store the rows of that relationships at first if a relationship row object is set.
 * 1. If the relationship is part of the id of that row it postpones the creation to the point in time
 *    when the corresponding row was stored.
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
  l.dev('alreadyStoredRows', storedRows.rows)

  let storedRow = storedRows.getStoredRowByOriginalRow(tableName, row)
  if (storedRow != undefined) {
    l.lib('Row already stored. Returning already stored row...', storedRow)
    return storedRow
  }

  storedRows.add(tableName, row)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  // check if the row has all the id's it could have and try to do something about it if not
  // 1. it will store any many-to-one and any one-to-one relationship first if the id is missing and if the relationship has a row object
  // 2. if the relationship points to the same table as the object which is about to be stored then it will store that relationship later so that
  //    the id of the row to be storeed is lower than the id of the relationship row
  // 3. if the id the relationship refers to is not generated then it will store the that relationship later so that we can set the id after we 
  //    stored the row that is to be stored which will then provide the missing id on the relationship

  l.lib('Storing missing many-to-one or one-to-one relationships first to be able to assign their id\'s before storing the actual row')
  for (let columnName of Object.keys(table.columns)) {
    l.location.push(columnName)

    let relationshipName = getCorrespondingManyToOne(table, columnName)

    if (relationshipName == undefined) {
      l.lib('The column is not part of a many-to-many or one-to-one relationship. Skipping...')
      continue
    }

    if (row[columnName] != undefined) {
      l.lib('The column already has a value which means that the relationship id is already set. Skipping...')
      continue
    }

    l.lib('Column is part of a relationship and its id is not set', columnName)
    l.lib('Relationship name', relationshipName)

    let relationship = table.relationships![relationshipName]
    if (relationship == undefined) {
      throw new Error(`Relationship '${relationshipName}' not contained table '${tableName}'`)
    }

    let otherTable = schema[relationship.otherTable]
    if (otherTable == undefined) {
      throw new Error('Table not contained in schema: ' + relationship.otherTable)
    }

    if (otherTable.columns[relationship.otherId] == undefined) {
      throw new Error(`Column '${relationship.otherId} not contained table '${relationship.otherTable}'`)
    }

    let relationshipRow = row[relationshipName]
    
    // check if there is a row object set for the relationship. if so store that one
    // first and then take the id from there
    if (typeof relationshipRow != 'object' || relationshipRow !== null) {
      l.lib('There is no relationship row. Skipping...')
      continue
    }

    l.lib('Trying to determine id by using relationship row', relationshipRow)

    // check if we already stored the relationship row or if it is about to be stored up the recursion chain
    if (storedRows.containsOriginalRow(relationship.otherTable, relationshipRow)) {
      let storedRelationshipRow = storedRows.getStoredRowByOriginalRow(relationship.otherTable, relationshipRow)

      // relationship row was already stored. use its id.
      if (storedRelationshipRow != undefined) {
        l.lib('Using id from already stored row', storedRelationshipRow)
        row[columnName] = storedRelationshipRow[relationship.otherId]
      }

      // if the relationship is an id for that row, attempt to store the whole row after the missing relationship
      // row which is about to be stored up the recursion chain
      else if (isForeignKey(table, relationship.thisId)) {
        l.lib('Row is about to be stored somewhere up the recursion chain and the relationship is an id. Adding handler after result is known. Returning...')

        storedRows.addAfterStoredRowHandler(relationshipRow, async () => {
          let l = log.fn('afterStoredRowHandler')
          l.lib('Storing row which was missing an id which came from a relationship which was just created...')

          let storedRow = await store(
            schema, 
            tableName, 
            db, 
            queryFn, 
            row, 
            storedRows, 
            relationshipPath != undefined ? relationshipPath + '.' + relationshipName : relationshipName
          )

          l.lib('Stored row', storedRow)
  
          if (storedRow == undefined) {
            throw new Error('Expected result to be not undefined')
          }
        })

        return // TODO: is this really good and working? It returns undefined. This is possible but not expected
      }

      // the relationship is about to be stored up the recursion chain. update the row that is to be stored after
      // the row of the relationship was stored up in the recursion chain.
      else {
        l.lib('Row is about to be stored somewhere up the recursion chain. Adding handler after result is known...')

        storedRows.addAfterStoredRowHandler(relationshipRow, async (storedRelationshipRow: any) => {
          let l = log.fn('afterStoredRowHandler')
          l.param('storedRelationshipRow', storedRelationshipRow)
          l.param('columnName', columnName)
          l.param('relationship', relationship)

          let storedRow = storedRows.getStoredRowByOriginalRow(tableName, row)
          l.lib('Stored row', storedRow)

          if (storedRow == undefined) {
            throw new Error('Could not set many-to-one relationship id')
          }

          let query = sql.update(tableName)

          for (let column of getPrimaryKey(table)) {
            if (storedRow[column] == undefined) {
              throw new Error('Some columns of primary are not set.')
            }

            query.where(comparison(column, storedRow[column]))
          }

          query.set(columnName, storedRelationshipRow[relationship.otherId])

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

          // storedRow[columnName] = storedRelationshipRow[relationship.otherId]
          // storedRow[relationshipName!] = storedRelationshipRow
        })
      }
    }

    // the relationship row was neither already stored before nor is it about to be stored up the recursion chain.
    // attempting to store it now.
    // 1. it will store any many-to-one relationship if it is not referencing the same table and if its id is generated
    // 2. if the relationship points to the same table as the object which is about to be stored then it will store that relationship later so that
    //    the id of the row to be stored is lower than the id of the relationship row
    // 3. if the id the relationship refers to is not generated then it will store the relationship row later so that we can set the id after we 
    //    stored the relationship owning row which will then provide the missing id on the relationship
    else {
      // the id of the row the relationship is referencing is generated. attempt to store it now.
      if (isForeignKey(otherTable, relationship.otherId)) {
        // if the relationship refers to the same table as the row that is to be stored, store the relationship row after
        // we stored the row that is to be stored.
        if (relationship.otherTable == tableName) {
          l.lib('Table of relationship is the same as the table of the relationship owning row. Storing relationship after storing the relationship owning row. Skipping for now..')
          continue
        }

        // the relationship row refers a different table and its id is generated. Store it now.
        l.lib('Storing the row object of the relationship. Going into recursion...')
        
        let storedRelationshipRow = await store(
          schema, 
          relationship.otherTable, 
          db, 
          queryFn, 
          row[relationshipName], 
          storedRows, 
          relationshipPath != undefined ? relationshipPath + '.' + relationshipName : relationshipName
        )

        l.lib('Returning from recursion...')
        l.lib('Setting relationship id from just stored relationship... ' + columnName + ' = ' + storedRelationshipRow[relationship.otherId])
        row[columnName] = storedRelationshipRow[relationship.otherId] 
      }
      // if the id the relationship is referencing is not generated we have to store the row that is to be stored first.
      // afterwards we can set the id on the row object.
      else {
        l.lib('Other id column is not generated. Storing relationship row after storing the relationhip owning row...')
      }
    }

    l.location.pop()
  }

  l.lib('Determining if to store or to update the given row...')
  
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

    storedRow = {
      '@update': true
    }

    for (let column of getPrimaryKey(table)) {
      storedRow[column] = row[column]
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

    storedRow = {
      '@update': false
    }

    for (let column of getPrimaryKey(table)) {
      storedRow[column] = row[column]
    }

    if (generatedPrimaryKey) {
      storedRow[generatedPrimaryKey] = result.insertId
    }
  }
  
  l.lib('Stored row', storedRow)
  l.calling('Triggering actions that can be down now after this row was stored...')

  try {
    await storedRows.setStoredRow(row, storedRow)
  }
  catch (e) {
    throw new Error(e as any)
  }

  l.called('Triggered actions after row was stored')

  if (table.relationships != undefined) {
    l.lib('Store remaining relationships...')

    for (let relationshipName of Object.keys(table.relationships)) {     
      l.location.push(relationshipName)
      l.lib('Trying to store relationship', relationshipName)
      
      let relationship = table.relationships[relationshipName]
      let column = table.columns[relationship.thisId]

      if (column == undefined) {
        throw new Error(`Column '${relationship.thisId}' not contained in table '${tableName}'`)
      }

      let relationshipTable = schema[relationship.otherTable]

      if (relationshipTable == undefined) {
        throw new Error('Table not contained in schema: ' + relationship.otherTable)
      }

      let otherTable = schema[relationship.otherTable]
      if (otherTable == undefined) {
        throw new Error('Table not contained in schema: ' + relationship.otherTable)
      }

      let otherRelationship: Relationship|undefined = undefined
      if (relationship.otherRelationship != undefined) {
        if (otherTable.relationships == undefined || otherTable.relationships[relationship.otherRelationship] == undefined) {
          throw new Error(`Other relationship '${relationship.otherRelationship}' referenced in '${tableName}.${relationshipName}' not contained in table '${relationship.otherTable}'`)
        }

        otherRelationship = otherTable.relationships[relationship.otherRelationship]
      }

      // if the relationship is many-to-one and the id is not set by now and there is a set relationship row object
      // attempt to set the id
      if (relationship.manyToOne && typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
        l.lib('Relationship is a many-to-one relationship with a given relationship row', row[relationshipName])

        let storedRelationshipRow = storedRows.getStoredRowByOriginalRow(relationship.otherTable, row[relationshipName])

        // if the id of this relationship is still not set, try to set it
        if (row[relationship.thisId] === undefined) {
          l.lib('The column with the id of the many end is not set', relationship.thisId)

          let relationshipId: any = undefined

          // at first check if we already stored the relationship row
          if (storedRelationshipRow) {
            l.lib('Relationship was already stored. Using id from it...', storedRelationshipRow)
  
            if (storedRelationshipRow[relationship.otherId] == undefined) {
              throw new Error('Already stored relationship row does not contain id which the relationship owning row wants to refer to')
            }
  
            relationshipId = storedRelationshipRow[relationship.otherId]
          }

          else if (storedRows.containsOriginalRow(relationship.otherTable, row[relationshipName])) {
            l.lib('Row of relationship is about to be stored up the recursion chain. Continuing...')
            continue
          }
          
          else {
            if (otherRelationship != undefined) {
              row[relationshipName][otherRelationship.thisId] = storedRow[otherRelationship.otherId]
            }
  
            l.calling('Storing the row object of the relationship. Going into recursion...', row[relationshipName])
            
            storedRelationshipRow = await store(
              schema, 
              relationship.otherTable, 
              db, 
              queryFn, 
              row[relationshipName], 
              storedRows, 
              relationshipPath != undefined ? relationshipPath + '.' + relationshipName : relationshipName
            )

            l.called('Returning from recursion...')
            l.lib('Setting relationship id from just stored relationship... ' + relationship.thisId + ' = ' + storedRelationshipRow[relationship.otherId])
  
            if (storedRelationshipRow[relationship.otherId] == undefined) {
              throw new Error('Already stored relationship row does not contain id which the relationship owning row wants to refer to')
            }
  
            relationshipId = storedRelationshipRow[relationship.otherId]

            l.lib('Setting relationship row on relationship owning row...', storedRelationshipRow)
            storedRow[relationshipName] = storedRelationshipRow
          }
  
          l.lib('Update the relationship owning row setting new newly obtained id', `${relationship.thisId} = ${relationshipId}`)

          let query = sql.update(tableName)

          for (let column of getPrimaryKey(table)) {
            if (storedRow[column] == undefined) {
              throw new Error('Some columns of primary are not set.')
            }

            query.where(comparison(column, storedRow[column]))
          }

          query.set(relationship.thisId, relationshipId)

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
            throw new Error(`Updated row to set the id of a many-to-one relationship and expected to update exactly one row, but updated ${result.affectedRows} rows instead. Please enable logging output for more details.`)
          }
    
          // l.dev('Setting relationship id on stored row', `${relationship.thisId} = ${relationshipId}`)
          // storedRow[relationship.thisId] = relationshipId
        }
        else {
          if (row[relationship.thisId] !== undefined) {
            l.lib('Relationship id is not empty. Work was already done...')
          }
          else {
            l.lib('Relationship does not have a row object. Skipping...')
          }
        }

        // // if we got a relationship row until now, set it on the stored row
        // if (storedRelationshipRow != undefined && storedRow[relationshipName] == undefined) {
        //   l.lib('Setting relationship row on relationship owning row...', storedRelationshipRow)
        //   storedRow[relationshipName] = storedRelationshipRow
        // }

        // if the relationship is one-to-one then we also need to update the id on the relationship row
        if (otherRelationship != undefined && storedRelationshipRow != undefined && storedRelationshipRow[otherRelationship.thisId] == undefined) {
          l.lib('Relationship is one-to-one. Setting id on already stored relationship row...', storedRelationshipRow)
          
          let query = sql.update(relationship.otherTable)

          for (let column of getPrimaryKey(otherTable)) {
            if (storedRelationshipRow[column] == undefined) {
              throw new Error('Some columns of primary are not set.')
            }

            query.where(comparison(column, storedRelationshipRow[column]))
          }

          query.set(otherRelationship.thisId, storedRow[otherRelationship.otherId])
  
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
            throw new Error(`The updated row count while setting the id of a one-to-one relationship was not exactly 1 but ${result.affectedRows}. Please enable logging for more details.`)
          }
    
          // l.dev('Setting relationship id on stored row', `${relationship.thisId} = ${relationshipId}`)
          // storedRow[relationshipName][otherRelationship.thisId] = storedRow[otherRelationship.otherId]
        }
      }
  
      // otherwise we just store the relationship
      else if (relationship.oneToMany == true && row[relationshipName] instanceof Array) {
        l.lib('One-to-many relationship. Storing all rows...')
        
        for (let relationshipRow of row[relationshipName]) {
          l.lib('Store next relationship row...', relationshipRow)

          if (! storedRows.containsOriginalRow(relationship.otherTable, relationshipRow)) {
            let otherTable = schema[relationship.otherTable]
            if (otherTable == undefined) {
              throw new Error('Table not contained in schema: ' + relationship.otherTable)
            }

            l.lib('Setting id on relationship row... ' + relationship.otherId + ' = ' + storedRow[relationship.thisId])
            relationshipRow[relationship.otherId] = storedRow[relationship.thisId]

            l.lib('Going into Recursion...')

            let storedRelationshipRow = await store(
              schema, 
              relationship.otherTable, 
              db, 
              queryFn, 
              relationshipRow, 
              storedRows,
              relationshipPath != undefined ? relationshipPath + '.' + relationshipName : relationshipName
            )

            l.lib('Returning from recursion...', storedRelationshipRow)

            if (storedRow[relationshipName] == undefined) {
              storedRow[relationshipName] = []
            }
            
            if (storedRelationshipRow != undefined) {  
              l.lib('Pushing stored relationship row into array on relationship owning row...')
              storedRow[relationshipName].push(storedRelationshipRow)
            }
            // if the result is undefined that means we could not store that row now because it depends on rows
            // which are being stored up the recursion chain. in this case we set a handler which triggers after
            // the row was stored. We do this to be able to add this particular one-to-many relationhip row to the
            // result row.
            else {
              l.lib('Row could not be stored because it is missing an id which is given through a relationship. Adding handler to push it into the stored row after it has been stored...')
              storedRows.addAfterStoredRowHandler(relationshipRow, async (storedRelationshipRow: any) => {
                let l = log.fn('afterSettingResultHandler')
                l.lib('Pushing stored relationship row into array on stored row...')
                storedRow[relationshipName].push(storedRelationshipRow)
              })
            }
          }
          else {
            l.lib('That particular row object is already being stored up the recursion chain. Continuing...')
          }
        }
      }
      else {
        l.lib('Relationship is not contained in the given row object. Continuing...')
      }

      l.location.pop()
    }
  }

  l.returning('Returning stored row...', storedRow)
  return storedRow
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