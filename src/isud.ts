import { Criteria } from 'knight-criteria'
import { Log } from 'knight-log'
import sql, { Query, value } from 'knight-sql'
import { getNotGeneratedPrimaryKeyColumns, getPrimaryKey, isGeneratedPrimaryKeyColumn, isPrimaryKeyColumn } from '.'
import { rowToUpdateCriteria, UpdateCriteria } from './criteriaTools'
import { addCriteria, buildSelectQuery } from './queryTools'
import { determineRelationshipsToLoad, areAllNotGeneratedPrimaryKeyColumnsSet, reduceToPrimaryKeys, unjoinRows } from './rowTools'
import { getCorrespondingManyToOne, isForeignKey, Relationship, Schema } from './Schema'
import { FiddledRows } from './util'

let log = new Log('knight-orm/isud.ts')

export async function isUpdate(
      schema: Schema,
      tableName: string,
      db: string,
      queryFn: (sqlString: string, values?: any[]) => Promise<any[]>,
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
    throw new Error(`At least one not generated primary key column (${getNotGeneratedPrimaryKeyColumns(table).join(', ')}) is not set. Please enable logging for more details.`)
  }

  let hasGeneratedPrimaryKeys = false
  let hasNotGeneratedPrimaryKeys = false
  let allGeneratedPrimaryKeysAreNull = true
  let allGeneratedPrimaryKeysAreNotNull = true

  for (let column of getPrimaryKey(table)) {
    if (isGeneratedPrimaryKeyColumn(table, column)) {
      hasGeneratedPrimaryKeys = true

      if (row[column] == null) {
        allGeneratedPrimaryKeysAreNotNull = false
      }
      else {
        allGeneratedPrimaryKeysAreNull = false
      }
    }
    else {
      hasNotGeneratedPrimaryKeys = true
    }
  }

  if (hasGeneratedPrimaryKeys && ! allGeneratedPrimaryKeysAreNull && ! allGeneratedPrimaryKeysAreNotNull) {
    throw new Error('There are generated primary keys which are null and generated primary keys which are not null. This is an inconsistent set of column values. Cannot determine if row is to be inserted or to be updated. Please enable logging for more details.')
  }

  if ((hasGeneratedPrimaryKeys && allGeneratedPrimaryKeysAreNotNull || ! hasGeneratedPrimaryKeys) && hasNotGeneratedPrimaryKeys) {
    l.lib('The row has not generated primary key columns. Determining if the row was already inserted.')
    
    let query = sql.select('*').from(tableName)

    for (let column of getPrimaryKey(table)) {
      query.where(column, '=', value(row[column]), 'AND')
    }

    let sqlString = query.sql(db)
    let values = query.values()
    let rows

    try {
      rows = await queryFn(sqlString, values)
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

  if (hasGeneratedPrimaryKeys && allGeneratedPrimaryKeysAreNotNull) {
    l.returning('The row does not have not generated primary key columns and all generated primary key columns are not null. Returning true...')
  }
  else {
    l.returning('The row does not have not generated primary key columns and all generated primary key columns are null. Returning false...')
  }

  return hasGeneratedPrimaryKeys && allGeneratedPrimaryKeysAreNotNull
}

/**
 * At first it goes through all columns which contain an id of a many-to-one relationship
 * and it tries to insert the rows of that relationships at first if a relationship row object is set.
 * 1. If the relationship is part of the id of that row it postpones the creation to the point in time
 *    when the corresponding row was inserted.
 * 
 * @param schema 
 * @param tableName 
 * @param db 
 * @param queryFn 
 * @param row 
 * @param alreadyInsertedRows 
 */
export async function store(
      schema: Schema, 
      tableName: string,
      db: string,
      queryFn: (sqlString: string, values?: any[]) => Promise<any[]>,
      row: any,
      alreadyInsertedRows: FiddledRows = new FiddledRows(schema),
      relationshipPath: string = 'root'
    ): Promise<any> {

  let l = log.fn('insert')
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
  l.param('alreadyInsertedRows', alreadyInsertedRows.fiddledRows)

  let alreadyInsertedRow = alreadyInsertedRows.getResultByRow(tableName, row)
  if (alreadyInsertedRow != undefined) {
    l.lib('Row already inserted. Returning already inserted row...', alreadyInsertedRow)
    return alreadyInsertedRow
  }

  alreadyInsertedRows.add(tableName, row)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  // check if the row has all the id's it could have and try to do something about it if not
  // 1. it will insert any many-to-one and any one-to-one relationship first if the id is missing and if the relationship has a row object
  // 2. if the relationship points to the same table as the object which is about to be inserted then it will insert that relationship later so that
  //    the id of the row to be inserted is lower than the id of the relationship row
  // 3. if the id the relationship refers to is not generated then it will insert the that relationship later so that we can set the id after we 
  //    inserted the row that is to be inserted which will then provide the missing id on the relationship
  l.lib('Inserting missing many-to-one relationships first to be able to assign their id\'s before inserting the actual row...')
  for (let columnName of Object.keys(table.columns)) {
    l.location.push(columnName)
    let relationshipName = getCorrespondingManyToOne(table, columnName)

    // the column is part of a relationship and its id is missing
    if (table.relationships != undefined && relationshipName != undefined && row[columnName] == undefined) {
      l.lib('Column is part of a relationship and its id is not set', columnName)
      l.lib('Relationship name', relationshipName)

      let relationship = table.relationships[relationshipName]
      if (relationship == undefined) {
        throw new Error(`Relationship '${relationshipName}' not contained table '${tableName}'`)
      }

      let otherTable = schema[relationship.otherTable]
      if (otherTable == undefined) {
        throw new Error('Table not contained in schema: ' + relationship.otherTable)
      }

      let relationshipRow = row[relationshipName]
      
      // check if there is a row object set for the relationship. if so insert that one
      // first and then take the id from there
      if (typeof relationshipRow == 'object' && relationshipRow !== null) {
        l.lib('Trying to determine id by using relationship row', relationshipRow)

        // check if we already inserted the relationship row or if it is about to be inserted up the recursion chain
        if (alreadyInsertedRows.containsRow(relationship.otherTable, relationshipRow)) {
          let alreadyInsertedRow = alreadyInsertedRows.getResultByRow(relationship.otherTable, relationshipRow)

          // relationship row was already inserted. use its id.
          if (alreadyInsertedRow != undefined) {
            l.lib('Using id from already inserted row', alreadyInsertedRow)
            row[columnName] = alreadyInsertedRow[relationship.otherId]
          }
          // if the relationship is an id for that row, attempt to insert the whole row after the missing relationship
          // row which is about to be inserted up the recursion chain
          else if (isForeignKey(table, relationship.thisId)) {
            l.lib('Row is about to be inserted somewhere up the recursion chain and the relationship is an id. Adding handler after result is known. Returning...')
            alreadyInsertedRows.addAfterSettingResultHandler(relationshipRow, async () => {
              let l = log.fn('afterSettingResultHandler')
              l.lib('Inserting row which was missing an id which came from a relationship which was just created...')

              let insertedRow = await store(
                schema, 
                tableName, 
                db, 
                queryFn, 
                row, 
                alreadyInsertedRows, 
                relationshipPath != undefined ? relationshipPath + '.' + relationshipName : relationshipName
              )

              l.lib('insertedRow', insertedRow)
      
              if (insertedRow == undefined) {
                throw new Error('Expected result to be not undefined')
              }
            })

            return
          }
          // the relationship is about to be inserted up the recursion chain. update the row that is to be inserted after
          // the row of the relationship was inserted up in the recursion chain.
          else {
            l.lib('Row is about to be inserted somewhere up the recursion chain. Adding handler after result is known...')
            alreadyInsertedRows.addAfterSettingResultHandler(row[relationshipName], async (insertedRelationshipRow: any) => {
              let l = log.fn('afterSettingResultHandler')
              l.param('insertedRelationshipRow', insertedRelationshipRow)
              l.param('columnName', columnName)
              l.param('relationship', relationship)

              let insertedRow = alreadyInsertedRows.getResultByRow(tableName, row)
              l.lib('insertedRow', insertedRow)

              if (insertedRow == undefined) {
                throw new Error('Could not set many-to-one relationship id')
              }

              let updateRow = reduceToPrimaryKeys(table, insertedRow)
              l.lib('updateRow', updateRow)

              let updateCriteria = rowToUpdateCriteria(schema, tableName, updateRow)
              updateCriteria[columnName] = insertedRelationshipRow[relationship.otherId]
              l.lib('updateCriteria', updateCriteria)
      
              let updatedRelationshipRows
              try {
                updatedRelationshipRows = await update(schema, tableName, db, queryFn, updateCriteria)
              }
              catch (e) {
                throw new Error(e as any)
              }
              
              l.lib('updatedRelationshipRows', updatedRelationshipRows)
      
              if (updatedRelationshipRows.length != 1) {
                throw new Error('Expected row count does not equal 1')
              }

              insertedRow[columnName] = updatedRelationshipRows[0][columnName]
              insertedRow[relationshipName!] = insertedRelationshipRow
            })
          }
        }
        // the relationship row was neither already inserted before nor is it about to be inserted up the recursion chain.
        // attempt to insert it now.
        // 1. it will insert any many-to-one relationship if it is not referencing the same table and if its id is generated
        // 2. if the relationship points to the same table as the object which is about to be inserted then it will insert that relationship later so that
        //    the id of the row to be inserted is lower than the id of the relationship row
        // 3. if the id the relationship refers to is not generated then it will insert the that relationship later so that we can set the id after we 
        //    inserted the row that is to be inserted which will then provide the missing id on the relationship
        else {
          if (otherTable.columns[relationship.otherId] == undefined) {
            throw new Error(`Column '${relationship.otherId} not contained table '${relationship.otherTable}'`)
          }

          // the id of the row the relationship is referencing is generated. attempt to insert it now
          if (isForeignKey(otherTable, relationship.otherId)) {
            // if the relationship refers to the same table as the row that is to be inserted, insert the relationship row after
            // we inserted the row that is to be inserted.
            if (relationship.otherTable == tableName) {
              l.lib('Table of relationship is the same as the table of the relationship owning row. Inserting relationship after inserting the relationship owning row...')
            }
            // the relationship row refers a different table and its id is generated. insert it now.
            else {
              l.lib('Inserting the row object of the relationship. Going into recursion...')
              
              let relationshipRow = await store(
                schema, 
                relationship.otherTable, 
                db, 
                queryFn, 
                row[relationshipName], 
                alreadyInsertedRows, 
                relationshipPath != undefined ? relationshipPath + '.' + relationshipName : relationshipName
              )

              l.lib('Returning from recursion...')
              l.lib('Setting relationship id from just inserted relationship... ' + columnName + ' = ' + relationshipRow[relationship.otherId])
              row[columnName] = relationshipRow[relationship.otherId]    
            }
          }
          // if the id the relationship is referencing is not generated we have to insert the row that is to be inserted first.
          // afterwards we can set the id on the row object.
          else {
            l.lib('Other id column is not generated. Inserting relationship row after inserting the relationhip owning row...')
          }
        }
      }
      // there is no row object set for the relationship. thus this relationship will be null.
      else {
        l.lib('Did not found a corresponding relationship row. Continuing...')
      }
    }
    else {
      l.dev('Column is not part of a many-to-one relationship or its value is already set. Skipping...', columnName)
    }

    l.location.pop()
  }

  l.lib('Determining if to insert or to update the given row...')
  
  let fiddledRow: any
  let doUpdate = await isUpdate(schema, tableName, db, queryFn, row)

  if (doUpdate) {
    l.lib('Updating the given row...')

    let query = sql.update(tableName)

    for (let column of Object.keys(table.columns)) {
      if (isPrimaryKeyColumn(table, column)) {
        query.where(column, '=', value(row[column]))
      }
      else if (row[column] !== undefined) {
        query.value(column, row[column])
      }
    }

    if (db == 'postgres') {
      query.returning('*')
    }
  
    let sqlString = query.sql(db)
    let values = query.values()
    
    l.lib('SQL string', sqlString)
    l.lib('Values', values)
  
    let updatedRows
    try {
      updatedRows = await queryFn(sqlString, values)
    }
    catch (e) {
      throw new Error(e as any)
    }
  
    l.lib('Updated rows', updatedRows)
  
    if (updatedRows.length != 1) {
      throw new Error(`Created ${updatedRows.length} rows while inserting ${relationshipPath}. Should have been exactly one row.`)
    }

    fiddledRow = updatedRows[0]
  }

  else {
    l.lib('Inserting the given row...')

    let query = sql.insertInto(tableName)

    for (let column of Object.keys(table.columns)) {
      if (row[column] !== undefined) {
        query.value(column, row[column])
      }
    }

    if (db == 'postgres') {
      query.returning('*')
    }
  
    let sqlString = query.sql(db)
    let values = query.values()
    
    l.lib('Sql String', sqlString)
    l.lib('Values', values)
  
    let insertedRows
    try {
      insertedRows = await queryFn(sqlString, values)
    }
    catch (e) {
      throw new Error(e as any)
    }
  
    l.lib('Inserted rows', insertedRows)
  
    if (insertedRows.length != 1) {
      throw new Error(`Created ${insertedRows.length} rows while inserting ${relationshipPath}. Should have been exactly one row.`)
    }

    fiddledRow = insertedRows[0]
  }
  
  l.calling('Setting result on fiddled row so that it is known that this row object was already inserted...')

  try {
    await alreadyInsertedRows.setResult(row, fiddledRow)
  }
  catch (e) {
    throw new Error(e as any)
  }

  l.called('Set result on fiddled row')

  if (table.relationships != undefined) {
    l.lib('Insert remaining relationships...')

    for (let relationshipName of Object.keys(table.relationships)) {     
      l.location.push(relationshipName)
      l.lib('Trying to insert relationship', relationshipName)
      
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
          throw new Error(`Relationship '${relationship.otherRelationship}' not contained in table '${relationship.otherTable}'`)
        }

        otherRelationship = otherTable.relationships[relationship.otherRelationship]
      }

      // if the relationship is many-to-one and the id is not set by now and there is a set relationship row object
      // attempt to set the id
      if (relationship.manyToOne && typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
        l.lib('Relationship is a many-to-one relationship with a given relationship row', row[relationshipName])

        let insertedRelationshipRow = alreadyInsertedRows.getResultByRow(relationship.otherTable, row[relationshipName])

        // if the id of this relationship is still not set, try to set it
        if (row[relationship.thisId] === undefined) {
          l.lib('The column with the id of the many end is not set', relationship.thisId)

          let relationshipId: any = undefined

          // at first check if we already inserted the relationship row
          if (insertedRelationshipRow) {
            l.lib('Relationship was already inserted. Using id from it...', insertedRelationshipRow)
  
            if (insertedRelationshipRow[relationship.otherId] == undefined) {
              throw new Error('Already inserted relationship row does not contain id which the relationship owning row wants to refer to')
            }
  
            relationshipId = insertedRelationshipRow[relationship.otherId]
          }
          else if (alreadyInsertedRows.containsRow(relationship.otherTable, row[relationshipName])) {
            l.lib('Row of relationship is about to be inserted up the recursion chain. Continuing...')
            continue
          }
          else {
            if (otherRelationship != undefined) {
              row[relationshipName][otherRelationship.thisId] = fiddledRow[otherRelationship.otherId]
            }
  
            l.calling('Inserting the row object of the relationship. Going into recursion...', row[relationshipName])
            
            insertedRelationshipRow = await store(
              schema, 
              relationship.otherTable, 
              db, 
              queryFn, 
              row[relationshipName], 
              alreadyInsertedRows, 
              relationshipPath != undefined ? relationshipPath + '.' + relationshipName : relationshipName
            )

            l.called('Returning from recursion...')
            l.lib('Setting relationship id from just inserted relationship... ' + relationship.thisId + ' = ' + insertedRelationshipRow[relationship.otherId])
  
            if (insertedRelationshipRow[relationship.otherId] == undefined) {
              throw new Error('Already inserted relationship row does not contain id which the relationship owning row wants to refer to')
            }
  
            relationshipId = insertedRelationshipRow[relationship.otherId]
          }
  
          l.lib('Update the relationship owning row setting new newly obtained id', `${relationship.thisId} = ${relationshipId}`)

          let updateRow = reduceToPrimaryKeys(table, fiddledRow)
          let updateCriteria = rowToUpdateCriteria(schema, tableName, updateRow)
          updateCriteria[relationship.thisId] = relationshipId

          l.calling('Calling update...')
  
          let updatedRows
          try {
            updatedRows = await update(schema, tableName, db, queryFn, updateCriteria)
          }
          catch (e) {
            throw new Error(e as any)
          }

          l.called('Called update...')
  
          if (updatedRows.length != 1) {
            throw new Error(`Updated row to set the id of a many-to-one relationship and expected to update exactly one row, but updated ${updatedRows.length} rows instead. Please enable logging output for more details.`)
          }
    
          l.dev('Setting relationship id on inserted row', `${relationship.thisId} = ${relationshipId}`)
          fiddledRow[relationship.thisId] = relationshipId
        }
        else {
          if (row[relationship.thisId] !== undefined) {
            l.lib('Relationship id is not empty. Work is already done...')
          }
          else {
            l.lib('Relationship does not have a row object. Skipping...')
          }
        }

        // if we got a relationship row until now, set it on the inserted row
        if (insertedRelationshipRow != undefined && fiddledRow[relationshipName] == undefined) {
          l.lib('Setting relationship row on relationship owning row...', insertedRelationshipRow)
          fiddledRow[relationshipName] = insertedRelationshipRow
        }

        // if the relationship is one-to-one then we also need to update the id on the relationship row
        if (otherRelationship != undefined && insertedRelationshipRow != undefined && insertedRelationshipRow[otherRelationship.thisId] == undefined) {
          l.lib('Relationship is one-to-one. Setting id on already inserted relationship row...', insertedRelationshipRow)
          
          let updateRow = reduceToPrimaryKeys(relationshipTable, insertedRelationshipRow)
          updateRow[otherRelationship.thisId] = fiddledRow[otherRelationship.otherId]
          l.dev('Update row', updateRow)
  
          let updateCriteria = rowToUpdateCriteria(schema, relationship.otherTable, updateRow)
          l.dev('Update criteria', updateCriteria)
  
          l.calling('Calling update...')

          let updatedOtherRelationshipRows
          try {
            updatedOtherRelationshipRows = await update(schema, relationship.otherTable, db, queryFn, updateCriteria)
          }
          catch (e) {
            throw new Error(e as any)
          }

          l.called('Called update...')

          l.lib('Updated other relationship rows', updatedOtherRelationshipRows)
  
          if (updatedOtherRelationshipRows.length != 1) {
            throw new Error(`The updated row count while setting the id of a one-to-one relationship was not exactly 1 but ${updatedOtherRelationshipRows.length}. Please enable logging for more details.`)
          }
    
          fiddledRow[relationshipName][otherRelationship.thisId] = updatedOtherRelationshipRows[0][otherRelationship.thisId]
        }
      }
  
      // otherwise we just insert the relationship
      else if (relationship.oneToMany == true && row[relationshipName] instanceof Array) {
        l.lib('One-to-many relationship. Inserting all rows...')
        
        for (let relationshipRow of row[relationshipName]) {
          l.lib('Insert next relationship row...', relationshipRow)

          if (! alreadyInsertedRows.containsRow(relationship.otherTable, relationshipRow)) {
            let otherTable = schema[relationship.otherTable]
            if (otherTable == undefined) {
              throw new Error('Table not contained in schema: ' + relationship.otherTable)
            }

            l.lib('Setting id on relationship row... ' + relationship.otherId + ' = ' + fiddledRow[relationship.thisId])
            relationshipRow[relationship.otherId] = fiddledRow[relationship.thisId]

            l.lib('Going into Recursion...')

            let insertedRelationshipRow = await store(
              schema, 
              relationship.otherTable, 
              db, 
              queryFn, 
              relationshipRow, 
              alreadyInsertedRows,
              relationshipPath != undefined ? relationshipPath + '.' + relationshipName : relationshipName
            )

            l.lib('Returning from recursion...', insertedRelationshipRow)

            if (fiddledRow[relationshipName] == undefined) {
              fiddledRow[relationshipName] = []
            }
            
            if (insertedRelationshipRow != undefined) {  
              l.lib('Pushing inserted relationship row into array on relationship owning row...')
              fiddledRow[relationshipName].push(insertedRelationshipRow)
            }
            // if the result is undefined that means we could not insert that row now because it depends on rows
            // which are being inserted up the recursion chain. in this case we set a handler which triggers after
            // the row was inserted. We do this to be able to add this particular one-to-many relationhip row to the
            // result row.
            else {
              l.lib('Row could not be inserted because it is missing an id which is given through a relationship. Adding handler to push it into the inserted row after it has been inserted...')
              alreadyInsertedRows.addAfterSettingResultHandler(relationshipRow, async (insertedRelationshipRow: any) => {
                let l = log.fn('afterSettingResultHandler')
                l.lib('Pushing inserted relationship row into array on inserted row...')
                fiddledRow[relationshipName].push(insertedRelationshipRow)
              })
            }
          }
          else {
            l.lib('That particular row object is already being inserted up the recursion chain. Continuing...')
          }
        }
      }
      else {
        l.lib('Relationship is not contained in the given row object. Continuing...')
      }

      l.location.pop()
    }
  }

  l.returning('Returning fiddledRow...', fiddledRow)
  return fiddledRow
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