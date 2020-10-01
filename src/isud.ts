import { DeleteCriteria, ReadCriteria, UpdateCriteria } from 'mega-nice-criteria'
import sql, { Query } from 'mega-nice-sql'
import { fillCreateCriteria, fillDeleteCriteria, fillUpdateCriteria } from 'mega-nice-sql-criteria-filler'
import { rowToDeleteCriteria, rowToUpdateCriteria } from './criteriaTools'
import { buildSelectQuery } from './queryTools'
import { filterValidColumns, idsOnly, unjoinRows } from './rowTools'
import { getRelationshipNameByColumn, isIdColumn, Schema } from './Schema'
import { FiddledRows } from './util'

export async function insert(
      schema: Schema, 
      tableName: string,
      db: string,
      queryFn: (sqlString: string, values?: any[]) => Promise<any[]>,
      row: any,
      alreadyInsertedRows: FiddledRows = new FiddledRows(schema),
      insertedRow?: any,
      insertedRowIntoTableName?: string
    ): Promise<any> {
  // console.debug('ENTERING insert...')
  // console.debug('tableName', tableName)
  // console.debug('db', db)
  // console.debug('row', row)
  // console.debug('alreadyInsertedRows', alreadyInsertedRows.fiddledRows)
  // console.debug('insertedRow', insertedRow)
  // console.debug('insertedRowIntoTableName', insertedRowIntoTableName)

  let alreadyInsertedRow = alreadyInsertedRows.getByRow(tableName, row)
  if (alreadyInsertedRow != undefined) {
    // console.debug('Row already inserted. Returning already inserted row...', alreadyInsertedRow)
    return alreadyInsertedRow
  }

  alreadyInsertedRows.add(tableName, row)

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  // check if the row has all the id's it could have and try to do something about it if not
  // console.debug('Looking for empty id\'s of many-to-one relationships...')
  for (let columnName of Object.keys(table.columns)) {
    let relationshipName = getRelationshipNameByColumn(columnName, table)

    // the column is part of a relationship and its id is missing
    if (table.relationships != undefined && relationshipName != undefined && row[columnName] == undefined) {
      let relationship = table.relationships[relationshipName]

      if (relationship == undefined) {
        throw new Error(`Relationship '${relationshipName} not contained table '${tableName}'.`)
      }
      
      // if the relationship is a many-to-one and this entity thus needs its id
      if (relationship.manyToOne || relationship.oneToOne != undefined) {
        // console.debug('Found empty id', columnName)
        // console.debug('relationship', relationship)

        let column = table.columns[relationship.thisId]

        if (column == undefined) {
          throw new Error(`Column '${relationship.thisId}' not contained in table '${tableName}'.`)
        }

        // at first check if the given inserted row is the one of the relationship and if so use 
        // the id from there
        if (relationship.otherTable == insertedRowIntoTableName && isIdColumn(column)) {
          // console.debug('The relationship was just inserted before. Retrieving id from given insertedRow', insertedRow)
          row[columnName] = insertedRow[relationship.otherId]
        }
        // otherwise check if there is a row object appended for the relationship. if so insert that one
        // first and then take the id from there
        else if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
          // console.debug('There is a row object for that relationship', row[relationshipName])

          if (alreadyInsertedRows.containsRow(relationship.otherTable, row[relationshipName])) {
            // console.debug('Row was already inserted or is about to be inserted')
            let alreadyInsertedRow = alreadyInsertedRows.getByRow(relationship.otherTable, row[relationshipName])
            // console.debug('alreadyInsertedRow', alreadyInsertedRow)
  
            if (alreadyInsertedRow != undefined) {
              // console.debug('Row was already inserted', alreadyInsertedRow)
              row[columnName] = alreadyInsertedRow[relationship.otherId]
            }
            else {
              // console.debug('Row is about to be inserted somewhere up the recursion chain')
            }
          }
          else {
            // console.debug('Inserting the row of the relationship first. Going into recursion...')
            let relationshipRow = await insert(schema, relationship.otherTable, db, queryFn, row[relationshipName], alreadyInsertedRows)
            // console.debug('Returning from recursion...')
            row[columnName] = relationshipRow[relationship.otherId]
          }
        }
        else {
          // console.debug('Relationship was neither inserted before nor was there a corresponding object in the row. Continuing...')
        }
      }
    }
  }

  // console.debug('Inserting the given row...')

  let query = sql.insertInto(tableName)
  fillCreateCriteria(query, row, Object.keys(table.columns))

  if (db == 'postgres') {
    query.returning('*')
  }

  let sqlString = query.sql(db)
  let values = query.values()
  
  // console.debug('sqlString', sqlString)
  // console.debug('values', values)

  let insertedRows = await queryFn(sqlString, values)
  // console.debug('insertedRows', insertedRows)

  if (insertedRows.length != 1) {
    throw new Error('Expected row count does not equal 1')
  }

  insertedRow = insertedRows[0]
  
  alreadyInsertedRows.setResult(row, insertedRow)
  // console.debug('alreadyInsertedRows', alreadyInsertedRows.fiddledRows)

  // console.debug('Insert remaining relationships...')

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      // console.debug('relationshipName', relationshipName)
      let relationship = table.relationships[relationshipName]
  
      // if the relationship leads back to were we are coming from continue
      if (relationship.otherTable == insertedRowIntoTableName && isIdColumn(table.columns[relationship.thisId])) {
        // console.debug('Relationship is the source. Continuing...')
        continue
      }
      // if the relationship is a one-to-one insert it
      else if (relationship.oneToOne != undefined) {
        // console.debug('Relationship is one-to-one')
  
        // get the table of the relationship
        let otherRelationshipTable = schema[relationship.otherTable]

        if (otherRelationshipTable == undefined) {
          throw new Error('Table not contained in schema: ' + relationship.otherTable)
        }

        if (otherRelationshipTable.relationships == undefined) {
          throw new Error(`Relationship '${relationship.oneToOne} not contained table '${relationship.otherTable}'.`)
        }

        let otherRelationship = otherRelationshipTable.relationships[relationship.oneToOne]
  
        // console.debug('otherRelationshipTable', otherRelationshipTable)
        // console.debug('otherRelationship', otherRelationship)
  
        if (otherRelationship == undefined) {
          throw new Error(`Relationship '${relationship.oneToOne} not contained table '${relationship.otherTable}'.`)
        }
  
        let otherRelationshipRow = alreadyInsertedRows.getByTableNameAndId(relationship.otherTable, relationship.otherId, insertedRow[relationship.thisId])
  
        if (otherRelationshipRow != undefined) {
          // console.debug('otherRelationshipRow', otherRelationshipRow)
          
          let idsOnlyRow = idsOnly(otherRelationshipTable, otherRelationshipRow)
          idsOnlyRow[otherRelationship.thisId] = insertedRow[otherRelationship.otherId]
          // console.debug('idsOnlyRow', idsOnlyRow)
  
          let updateCriteria = rowToUpdateCriteria(schema, otherRelationship.otherTable, idsOnlyRow)
          // console.debug('updateCriteria', updateCriteria)
  
          let updatedOtherRelationshipRows = await update(schema, otherRelationship.otherTable, db, queryFn, updateCriteria)
          // console.debug('updatedOtherRelationshipRows', updatedOtherRelationshipRows)
  
          if (updatedOtherRelationshipRows.length != 1) {
            throw new Error('Expected row count does not equal 1')
          }
    
          insertedRow[relationshipName] = updatedOtherRelationshipRows[0]
        }
        else {
          // console.debug('Could not determine the row of the one-to-one relationship now')
        }
  
      }
      // we already inserted that particular row object and now we just want to set it on the resulting insertedRow object
      else if (alreadyInsertedRows.containsRow(tableName, row[relationshipName])) {
        let alreadyInsertedRow = alreadyInsertedRows.getByRow(relationship.otherTable, row[relationshipName])
  
        if (alreadyInsertedRow != undefined) {
          // console.debug('Row was already inserted. Setting it on the resulting insertedRow object...')
          insertedRow[relationshipName] = alreadyInsertedRow
        }
        else {
          // console.debug('Row is about to be inserted up the recursion chain. Continuing...')
        }
  
        continue
      }
      // otherwise we just insert the relationship
      else if (row[relationshipName] != undefined) {
        // console.debug('Relationship is present in the given row', relationship)
  
        if (row[relationshipName] instanceof Array) {
          // console.debug('One-to-many relationship. Inserting all rows...')
          
          for (let relationshipRow of row[relationshipName]) {
            // console.debug('relationshipRow', relationshipRow)
  
            if (! alreadyInsertedRows.containsRow(relationship.otherTable, relationshipRow)) {
              // console.debug('Inserting. Going into Recursion...')
  
              let insertedRelationshipRow = await insert(schema, relationship.otherTable, db, queryFn, relationshipRow, alreadyInsertedRows, insertedRow, tableName)
              // console.debug('Returning from recursion...', insertedRelationshipRow)
              
              if (insertedRelationshipRow != undefined) {
                if (insertedRow[relationshipName] == undefined) {
                  insertedRow[relationshipName] = []
                }
    
                insertedRow[relationshipName].push(insertedRelationshipRow)
              }  
            }
            else {
              // console.debug('That particular row object is already being inserted up the recursion chain. Continuing...')
            }
          }
        }
        else {
          // console.debug('No supported relationship type. Was neither many-to-one nor one-to-many.')
        }
      }
      else {
        // console.debug('Relationship is not contained in the given row object. Continuing...')
      }
    }
  }

  // console.debug('Returning insertedRow...', insertedRow)
  return insertedRow
}

export async function select(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: ReadCriteria): Promise<any[]> {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let query = buildSelectQuery(schema, tableName, criteria)

  let sqlString = query.sql(db)
  let values = query.values()

  // console.debug('sqlString', sqlString)
  // console.debug('values', values)

  let joinedRows = await queryFn(sqlString, values)
  let rows = unjoinRows(schema, tableName, joinedRows, criteria)

  return rows
}

// https://stackoverflow.com/questions/1293330/how-can-i-do-an-update-statement-with-join-in-sql-server
export async function update(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: UpdateCriteria): Promise<any[]> {
  // console.debug('ENTERING update...')
  // console.debug('tableName', tableName)
  // console.debug('criteria', criteria)

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

  // console.debug('sqlString', sqlString)
  // console.debug('values', values)

  let updatedRows = await queryFn(sqlString, values)
  // console.debug('updatedRows', updatedRows)

  return updatedRows
}

export async function delete_(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, criteria: DeleteCriteria, alreadyDeletedRows: FiddledRows = new FiddledRows(schema)): Promise<any[]> {
  // console.debug('ENTERING delete_...')
  // console.debug('tableName', tableName)
  // console.debug('criteria', criteria)
  // console.debug('alreadyDeletedRows', alreadyDeletedRows.fiddledRows)

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  // at first look if there is a typo in a column name because if so it would be left out in the
  // query and thus not be taken into consideration which will have the effect of unwanted deletions
  // which we want to prevent by checking if the given criteria only contains valid column names
  let filteredCriteria = filterValidColumns(schema, tableName, criteria)
  // console.debug('filteredCriteria', filteredCriteria)

  if (Object.keys(criteria).length != Object.keys(filteredCriteria).length) {
    throw new Error('Given criteria contained invalid columns ' + JSON.stringify(criteria))
  }

  // we need to find out what we are going to delete because it may be the case that
  // one or two or all id's are missing
  let rowsToDelete = await select(schema, tableName, db, queryFn, criteria)
  // console.debug('rowsToDelete', rowsToDelete)

  let deletedRows: any[] = []

  // next we go through all the row that are to be deleted and start with deleting
  // their relationships, those who want to be deleted

  // console.debug('Deleting relationships...')

  for (let row of rowsToDelete) {
    // console.debug('row', row)

    if (alreadyDeletedRows.containsRow(tableName, row)) {
      // console.debug('Row is already deleted or about to be deleted. Continuing...')
      continue
    }

    // console.debug('Adding row to alreadyDeletedRows...')
    alreadyDeletedRows.add(tableName, row)

    let relationshipToDeletedRows: {[relationship: string]: any|any[]} = {}

    if (table.relationships != undefined) {
      for (let relationshipName of Object.keys(table.relationships)) {
        // console.debug('relationshipName', relationshipName)
    
        let relationship = table.relationships[relationshipName]
        // console.debug('relationship', relationship)
    
        if (! relationship.delete) {
          // console.debug('Relationship should not be deleted. Continuing...')
          continue
        }
    
        if (row[relationship.thisId] == undefined) {
          // console.debug('Row does not contain an id for this relationship thus there is nothing to delete. Continuing...')
          continue
        }
    
        let relationshipDeleteCriteria: DeleteCriteria = {
          [relationship.otherId]: row[relationship.thisId]
        }
    
        // console.debug('relationshipDeleteCriteria', relationshipDeleteCriteria)
    
        // console.debug('Deleting relationship. Going into recursion...')
        let deletedRows = await delete_(schema, relationship.otherTable, db, queryFn, relationshipDeleteCriteria, alreadyDeletedRows)
        // console.debug('Coming back from recursion...')
        // console.debug('deletedRows', deletedRows)
  
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
  
    // console.debug('sqlString', sqlString)
    // console.debug('values', values)
  
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
    
  // console.debug('Returning deleted rows...', deletedRows)
  return deletedRows
}