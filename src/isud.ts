import { DeleteCriteria, ReadCriteria, UpdateCriteria } from 'mega-nice-criteria'
import Log from 'mega-nice-log'
import sql, { Query } from 'mega-nice-sql'
import { fillCreateCriteria, fillDeleteCriteria, fillUpdateCriteria } from 'mega-nice-sql-criteria-filler'
import { rowToDeleteCriteria, rowToUpdateCriteria } from './criteriaTools'
import { buildSelectQuery } from './queryTools'
import { filterValidColumns, idsOnly, unjoinRows } from './rowTools'
import { getRelationshipNameByColumn, isGeneratedIdColumn, Schema } from './Schema'
import { FiddledRows } from './util'

let log = new Log('mega-nice-sql-orm/isud.ts')

/**
 * At first it goes through all columns which contain an id of a many-to-one or one-to-one relationship
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
export async function insert(
      schema: Schema, 
      tableName: string,
      db: string,
      queryFn: (sqlString: string, values?: any[]) => Promise<any[]>,
      row: any,
      alreadyInsertedRows: FiddledRows = new FiddledRows(schema)
    ): Promise<any> {
  let l = log.fn('insert')
  l.debug('parameter: tableName', tableName)
  l.debug('parameter: db', db)
  l.debug('parameter: row', row)
  l.debug('parameter: alreadyInsertedRows', alreadyInsertedRows.fiddledRows)

  let alreadyInsertedRow = alreadyInsertedRows.getResultByRow(tableName, row)
  if (alreadyInsertedRow != undefined) {
    l.debug('Row already inserted. Returning already inserted row...', alreadyInsertedRow)
    return alreadyInsertedRow
  }

  alreadyInsertedRows.add(tableName, row)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  // check if the row has all the id's it could have and try to do something about it if not
  // 1. it will insert any many-to-one and any one-to-one relationship first if the id is missing and if there if the relationship has a row object
  // 2. if the relationship points to the same table as the object which is about to be inserted then it will insert that relationship later so that
  //    the id of the row to be inserted is lower than the id of the relationship row
  // 3. if the id the relationship refers to is not generated then it will insert the that relationship later so that we can set the id after we 
  //    inserted the row that is to be inserted which will then provide the missing id on the relationship
  l.debug('Inserting missing many-to-one and one-to-one relationships first to be able to assign their id\'s before inserting the actual row...')
  for (let columnName of Object.keys(table.columns)) {
    let relationshipName = getRelationshipNameByColumn(table, columnName)

    // the column is part of a relationship and its id is missing
    if (table.relationships != undefined && relationshipName != undefined && row[columnName] == undefined) {
      let relationship = table.relationships[relationshipName]

      if (relationship == undefined) {
        throw new Error(`Relationship '${relationshipName}' not contained table '${tableName}'`)
      }

      let otherTable = schema[relationship.otherTable]

      if (otherTable == undefined) {
        throw new Error('Table not contained in schema: ' + relationship.otherTable)
      }

      let relationshipRow = row[relationshipName]
      
      // if the relationship is a many-to-one or a one-to-one and this row thus needs its id
      if (relationship.manyToOne || relationship.oneToOne != undefined) {
        l.debug(`Trying to determine id for '${columnName}'`, relationship)

        // check if there is a row object set for the relationship. if so insert that one
        // first and then take the id from there
        if (typeof relationshipRow == 'object' && relationshipRow !== null) {
          // check if we already inserted the relationship row or if it is about to be inserted up the recursion chain
          if (alreadyInsertedRows.containsRow(relationship.otherTable, relationshipRow)) {
            let alreadyInsertedRow = alreadyInsertedRows.getResultByRow(relationship.otherTable, relationshipRow)

            // relationship row was already inserted. use its id.
            if (alreadyInsertedRow != undefined) {
              l.debug('Using id from already inserted row', alreadyInsertedRow)
              row[columnName] = alreadyInsertedRow[relationship.otherId]
            }
            // if the relationship is an id for that row, attempt to insert the whole row after the missing relationship
            // row which is about to be inserted up the recursion chain.
            else if (isGeneratedIdColumn(table, relationship.thisId)) {
              l.debug('Row is about to be inserted somewhere up the recursion chain and the relationship is an id. Adding handler after result is known. Returning...')
              alreadyInsertedRows.addAfterSettingResultHandler(relationshipRow, async () => {
                let l = log.fn('afterSettingResultHandler')
                l.debug('Inserting row which was missing an id which came from a relationship which was just created...')

                let insertedRow = await insert(schema, tableName, db, queryFn, row, alreadyInsertedRows)
                l.debug('insertedRow', insertedRow)
        
                if (insertedRow == undefined) {
                  throw new Error('Expected result to be not undefined')
                }
              })

              return
            }
            // the relationship is about to be inserted up the recursion chain. update the row that is to be inserted after
            // the row of the relationship was inserted up in the recursion chain.
            else {
              l.debug('Row is about to be inserted somewhere up the recursion chain. Adding handler after result is known...')
              alreadyInsertedRows.addAfterSettingResultHandler(row[relationshipName], async (insertedRelationshipRow: any) => {
                let l = log.fn('afterSettingResultHandler')
                l.debug('parameter: insertedRelationshipRow', insertedRelationshipRow)
                l.debug('parameter: columnName', columnName)
                l.debug('parameter: relationship', relationship)

                let insertedRow = alreadyInsertedRows.getResultByRow(tableName, row)
                l.debug('insertedRow', insertedRow)

                if (insertedRow == undefined) {
                  throw new Error('Could not set many-to-one relationship id')
                }

                let updateRow = idsOnly(table, insertedRow)
                l.debug('updateRow', updateRow)

                let updateCriteria = rowToUpdateCriteria(schema, tableName, updateRow)
                updateCriteria.set[columnName] = insertedRelationshipRow[relationship.otherId]
                l.debug('updateCriteria', updateCriteria)
        
                let updatedRelationshipRows = await update(schema, tableName, db, queryFn, updateCriteria)
                l.debug('updatedRelationshipRows', updatedRelationshipRows)
        
                if (updatedRelationshipRows.length != 1) {
                  throw new Error('Expected row count does not equal 1')
                }

                insertedRow[columnName] = updatedRelationshipRows[0][columnName]
              })
            }
          }
          // the relationship row was neither already inserted before nor is it about to be inserted up the recursion chain.
          // attempt to insert it now.
          // 1. it will insert any many-to-one and any one-to-one relationship if it is not referencing the same table and if its id is generated
          // 2. if the relationship points to the same table as the object which is about to be inserted then it will insert that relationship later so that
          //    the id of the row to be inserted is lower than the id of the relationship row
          // 3. if the id the relationship refers to is not generated then it will insert the that relationship later so that we can set the id after we 
          //    inserted the row that is to be inserted which will then provide the missing id on the relationship
          else {
            if (otherTable.columns[relationship.otherId] == undefined) {
              throw new Error(`Column '${relationship.otherId} not contained table '${relationship.otherTable}'`)
            }

            // the id of the row the relationship is referencing is generated. attempt to insert it now
            if (isGeneratedIdColumn(otherTable, relationship.otherId)) {
              // if the relationship refers to the same table as the row that is to be inserted, insert the relationship row after
              // we inserted the row that is to be inserted.
              if (relationship.otherTable == tableName) {
                l.debug('Table of relationship is the same as the table of the relationship owning row. Inserting relationship after inserting the relationship owning row...')
              }
              // the relationship row refers a different table and its id is generated. insert it now.
              else {
                l.debug('Inserting the row object of the relationship. Going into recursion...')
                let relationshipRow = await insert(schema, relationship.otherTable, db, queryFn, row[relationshipName], alreadyInsertedRows)
                l.debug('Returning from recursion...')
                l.debug('Setting relationship id from just inserted relationship... ' + columnName + ' = ' + relationshipRow[relationship.otherId])
                row[columnName] = relationshipRow[relationship.otherId]    
              }
            }
            // if the id the relationship is referencing is not generated we have to insert the row that is to be inserted first.
            // afterwards we can set the id on the row object.
            else {
              l.debug('Other id column is not generated. Inserting relationship row after inserting the relationhip owning row...')
            }
          }
        }
        // there is no row object set for the relationship. thus this relationship will be null.
        else {
          l.debug('Relationship was neither inserted before nor was there a corresponding row object. Continuing...')
        }
      }
    }
  }

  l.debug('Inserting the given row...')

  let query = sql.insertInto(tableName)
  fillCreateCriteria(query, row, Object.keys(table.columns))

  if (db == 'postgres') {
    query.returning('*')
  }

  let sqlString = query.sql(db)
  let values = query.values()
  
  l.debug('sqlString', sqlString)
  l.debug('values', values)

  let insertedRows = await queryFn(sqlString, values)
  l.debug('insertedRows', insertedRows)

  if (insertedRows.length != 1) {
    throw new Error('Expected row count does not equal 1')
  }

  let insertedRow = insertedRows[0]
  
  l.debug('Setting result on alreadyInsertedRows...')

  try {
    await alreadyInsertedRows.setResult(row, insertedRow)
  }
  catch (e) {
    throw e
  }

  l.debug('Insert remaining relationships...')

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {      
      let relationship = table.relationships[relationshipName]
      let column = table.columns[relationship.thisId]

      if (column == undefined) {
        throw new Error(`Column '${relationship.thisId}' not contained in table '${tableName}'`)
      }

      let relationshipTable = schema[relationship.otherTable]

      if (relationshipTable == undefined) {
        throw new Error('Table not contained in schema: ' + relationship.otherTable)
      }

      l.debug('Trying to insert relationship', relationshipName, relationship)

      // if the relationship is many-to-one or one-to-one and the id is not set by now and there is a set relationship row object
      // attempt to set the id
      if ((relationship.manyToOne || relationship.oneToOne != undefined) && row[relationship.thisId] === undefined && typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
        // if the id of the relationship is not set it can be for one of the following reasons
        // 1. the id of the relationship refers to the same table thus we wanted to insert the relationship owning row first
        //    to have a lower id on it
        // 2. the id of the relationship is not generated so we needed to insert the relationship owning row first to have
        //    an id available. note: if the relationship is one-to-one then we also need to set the id on the relationship row.
        // 3. the relationship is one-to-one thus we also set the id on the relationship owning row after we inserted the
        //    the relationship row

        let relationshipId: any = undefined

        // at first check if we already inserted the relationship row
        let relationshipRow = alreadyInsertedRows.getResultByRow(relationship.otherTable, row[relationshipName])
        if (relationshipRow) {
          l.debug('Relationship was already inserted. Using id from it...', relationshipRow)

          if (relationshipRow[relationship.otherId] == undefined) {
            throw new Error('Already inserted relationship row does not contain id which the relationship owning row wants to refer to')
          }

          relationshipId = relationshipRow[relationship.otherId]
        }
        else if (alreadyInsertedRows.containsRow(relationship.otherTable, row[relationshipName])) {
          l.debug('Row of relationship is about to be inserted up the recursion chain. Continuing...')
          continue
        }
        else {
          if (relationship.oneToOne != undefined) {
            let otherTable = schema[relationship.otherTable]

            if (otherTable == undefined) {
              throw new Error('Table not contained in schema: ' + relationship.otherTable)
            }

            if (otherTable.relationships == undefined) {
              throw new Error(`Relationship '${relationship.oneToOne}' not contained in table '${relationship.otherTable}'`)
            }

            let otherRelationship = otherTable.relationships[relationship.oneToOne]

            if (otherRelationship == undefined) {
              throw new Error(`Relationship '${relationship.oneToOne}' not contained in table '${relationship.otherTable}'`)
            }

            row[relationshipName][otherRelationship.thisId] = insertedRow[otherRelationship.otherId]
          }

          l.debug('Inserting the row object of the relationship. Going into recursion...', row[relationshipName])
          relationshipRow = await insert(schema, relationship.otherTable, db, queryFn, row[relationshipName], alreadyInsertedRows)
          l.debug('Returning from recursion...')
          l.debug('Setting relationship id from just inserted relationship... ' + relationship.thisId + ' = ' + relationshipRow[relationship.otherId])

          if (relationshipRow[relationship.otherId] == undefined) {
            throw new Error('Already inserted relationship row does not contain id which the relationship owning row wants to refer to')
          }

          relationshipId = relationshipRow[relationship.otherId]
        }

        // update the relationship owning row setting new newly obtained id
        let updateRow: any = idsOnly(table, insertedRow)
        let updateCriteria = rowToUpdateCriteria(schema, tableName, updateRow)
        updateCriteria.set = {}
        updateCriteria.set[relationship.thisId] = relationshipId

        let updatedRows = await update(schema, tableName, db, queryFn, updateCriteria)

        if (updatedRows.length != 1) {
          throw new Error('Expected row count does not equal 1')
        }
  
        insertedRow[relationship.thisId] = relationshipId
        insertedRow[relationshipName] = relationshipRow

        // if the relationship is one-to-one then we also need to update the id on the relationship row
        if (relationship.oneToOne != undefined) {
          if (relationshipTable.relationships == undefined) {
            throw new Error(`Relationship '${relationship.oneToOne} not contained table '${relationship.otherTable}'`)
          }
  
          let oneToOneRelationshipOfRelationship = relationshipTable.relationships[relationship.oneToOne]
    
          if (oneToOneRelationshipOfRelationship == undefined) {
            throw new Error(`Relationship '${relationship.oneToOne} not contained table '${relationship.otherTable}'`)
          }
    
          let relationshipRow = alreadyInsertedRows.getByTableNameAndId(relationship.otherTable, relationship.otherId, insertedRow[relationship.thisId])
    
          if (relationshipRow != undefined && relationshipRow[oneToOneRelationshipOfRelationship.thisId] === undefined) {
            l.debug('Relationship is one-to-one. Setting id from already inserted relationship row...', relationshipRow)
            
            let updateRow = idsOnly(relationshipTable, relationshipRow)
            updateRow[oneToOneRelationshipOfRelationship.thisId] = insertedRow[oneToOneRelationshipOfRelationship.otherId]
            l.debug('updateRow', updateRow)
    
            let updateCriteria = rowToUpdateCriteria(schema, oneToOneRelationshipOfRelationship.otherTable, updateRow)
            l.debug('updateCriteria', updateCriteria)
    
            let updatedOtherRelationshipRows = await update(schema, oneToOneRelationshipOfRelationship.otherTable, db, queryFn, updateCriteria)
            l.debug('updatedOtherRelationshipRows', updatedOtherRelationshipRows)
    
            if (updatedOtherRelationshipRows.length != 1) {
              throw new Error('Expected row count does not equal 1')
            }
      
            insertedRow[relationshipName] = updatedOtherRelationshipRows[0]
          }  
        }
      }
  
      // we already inserted that particular row object and now we just want to set it on the resulting insertedRow object
      else if (alreadyInsertedRows.containsRow(tableName, row[relationshipName])) {
        let alreadyInsertedRow = alreadyInsertedRows.getResultByRow(relationship.otherTable, row[relationshipName])
  
        if (alreadyInsertedRow != undefined) {
          l.debug('Row was already inserted. Setting it on the resulting insertedRow object...')
          insertedRow[relationshipName] = alreadyInsertedRow
        }
        else {
          l.debug('Row is about to be inserted up the recursion chain. Continuing...')
        }
  
        continue
      }
      // otherwise we just insert the relationship
      else if (relationship.oneToMany == true && row[relationshipName] instanceof Array) {
        l.debug('One-to-many relationship. Inserting all rows...')
        
        for (let relationshipRow of row[relationshipName]) {
          l.debug('Inserting relationship row...', relationshipRow)

          if (! alreadyInsertedRows.containsRow(relationship.otherTable, relationshipRow)) {
            let otherTable = schema[relationship.otherTable]
            if (otherTable == undefined) {
              throw new Error('Table not contained in schema: ' + relationship.otherTable)
            }

            l.debug('Setting id on relationship row... ' + relationship.otherId + ' = ' + insertedRow[relationship.thisId])
            relationshipRow[relationship.otherId] = insertedRow[relationship.thisId]

            l.debug('Going into Recursion...')

            let insertedRelationshipRow = await insert(schema, relationship.otherTable, db, queryFn, relationshipRow, alreadyInsertedRows)
            l.debug('Returning from recursion...', insertedRelationshipRow)

            if (insertedRow[relationshipName] == undefined) {
              insertedRow[relationshipName] = []
            }
            
            if (insertedRelationshipRow != undefined) {  
              l.debug('Pushing inserted relationship row into array on inserted row...')
              insertedRow[relationshipName].push(insertedRelationshipRow)
            }
            // if the result is undefined that means we could not insert that row now because it depends on rows
            // which are being inserted up the recursion chain. in this case we set a handler which triggers after
            // the row was inserted. We do this to be able to add this particular one-to-many relationhip row to the
            // result row.
            else {
              l.debug('Row could not be inserted because it is missing an id which is given through a relationship. Adding handler to push it into the inserted row after it has been inserted...')
              alreadyInsertedRows.addAfterSettingResultHandler(relationshipRow, async (insertedRelationshipRow: any) => {
                let l = log.fn('afterSettingResultHandler')
                l.debug('Pushing inserted relationship row into array on inserted row...')
                insertedRow[relationshipName].push(insertedRelationshipRow)
              })
            }
          }
          else {
            l.debug('That particular row object is already being inserted up the recursion chain. Continuing...')
          }
        }
      }
      else {
        l.debug('Relationship is not contained in the given row object. Continuing...')
      }
    }
  }

  l.debug('Returning insertedRow...', insertedRow)
  return insertedRow
}

export async function select(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: ReadCriteria): Promise<any[]> {
  let l = log.fn('select')

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = buildSelectQuery(schema, tableName, criteria)

  let sqlString = query.sql(db)
  let values = query.values()

  l.debug('sqlString', sqlString)
  l.debug('values', values)

  let joinedRows = await queryFn(sqlString, values)
  let rows = unjoinRows(schema, tableName, joinedRows, criteria)

  return rows
}

// https://stackoverflow.com/questions/1293330/how-can-i-do-an-update-statement-with-join-in-sql-server
export async function update(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: UpdateCriteria): Promise<any[]> {
  let l = log.fn('update')
  l.debug('tableName', tableName)
  l.debug('criteria', criteria)

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = new Query
  query.update(tableName)
  fillUpdateCriteria(query, criteria, Object.keys(table.columns))
  query.returning('*')

  let sqlString = query.sql(db)
  let values = query.values()

  l.debug('sqlString', sqlString)
  l.debug('values', values)

  let updatedRows = await queryFn(sqlString, values)
  l.debug('updatedRows', updatedRows)

  return updatedRows
}

export async function delete_(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: DeleteCriteria, alreadyDeletedRows: FiddledRows = new FiddledRows(schema)): Promise<any[]> {
  let l = log.fn('delete_')
  l.debug('tableName', tableName)
  l.debug('criteria', criteria)
  l.debug('alreadyDeletedRows', alreadyDeletedRows.fiddledRows)

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  // at first look if there is a typo in a column name because if so it would be left out in the
  // query and thus not be taken into consideration which will have the effect of unwanted deletions
  // which we want to prevent by checking if the given criteria only contains valid column names
  let filteredCriteria = filterValidColumns(schema, tableName, criteria)
  l.debug('filteredCriteria', filteredCriteria)

  if (Object.keys(criteria).length != Object.keys(filteredCriteria).length) {
    throw new Error('Given criteria contained invalid columns ' + JSON.stringify(criteria))
  }

  // we need to find out what we are going to delete because it may be the case that
  // one or two or all id's are missing
  let rowsToDelete = await select(schema, tableName, db, queryFn, criteria)
  l.debug('rowsToDelete', rowsToDelete)

  let deletedRows: any[] = []

  // next we go through all the row that are to be deleted and start with deleting
  // their relationships, those who want to be deleted

  l.debug('Deleting relationships...')

  for (let row of rowsToDelete) {
    l.debug('row', row)

    if (alreadyDeletedRows.containsRow(tableName, row)) {
      l.debug('Row is already deleted or about to be deleted. Continuing...')
      continue
    }

    l.debug('Adding row to alreadyDeletedRows...')
    alreadyDeletedRows.add(tableName, row)

    let relationshipToDeletedRows: {[relationship: string]: any|any[]} = {}

    if (table.relationships != undefined) {
      for (let relationshipName of Object.keys(table.relationships)) {
        l.debug('relationshipName', relationshipName)
    
        let relationship = table.relationships[relationshipName]
        l.debug('relationship', relationship)
    
        if (! relationship.delete) {
          l.debug('Relationship should not be deleted. Continuing...')
          continue
        }
    
        if (row[relationship.thisId] == undefined) {
          l.debug('Row does not contain an id for this relationship thus there is nothing to delete. Continuing...')
          continue
        }
    
        let relationshipDeleteCriteria: DeleteCriteria = {
          [relationship.otherId]: row[relationship.thisId]
        }
    
        l.debug('relationshipDeleteCriteria', relationshipDeleteCriteria)
    
        l.debug('Deleting relationship. Going into recursion...')
        let deletedRows = await delete_(schema, relationship.otherTable, db, queryFn, relationshipDeleteCriteria, alreadyDeletedRows)
        l.debug('Coming back from recursion...')
        l.debug('deletedRows', deletedRows)
  
        if (relationship.manyToOne || relationship.oneToOne != undefined) {
          if (deletedRows.length == 1) {
            relationshipToDeletedRows[relationshipName] = deletedRows[0]
          }
        }
        else if (deletedRows.length > 0) {
          relationshipToDeletedRows[relationshipName] = deletedRows
        }
      }  
    }

    let rowDeleteCriteria = rowToDeleteCriteria(schema, tableName, row)

    let query = sql.deleteFrom(tableName)
    fillDeleteCriteria(query, rowDeleteCriteria, Object.keys(table.columns))
    query.returning('*')
  
    let sqlString = query.sql(db)
    let values = query.values()
  
    l.debug('sqlString', sqlString)
    l.debug('values', values)
  
    let deletedRowsOfSingleRow = await queryFn(sqlString, values)

    if (deletedRowsOfSingleRow.length != 1) {
      throw new Error('Expected row count does not equal 1')
    }

    let deletedRow = deletedRowsOfSingleRow[0]

    // attach the deleted rows of all relationships
    for (let relationshipName of Object.keys(relationshipToDeletedRows)) {
      deletedRow[relationshipName] = relationshipToDeletedRows[relationshipName]
    }

    deletedRows.push(deletedRow)
  }
    
  l.debug('Returning deleted rows...', deletedRows)
  return deletedRows
}