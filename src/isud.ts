import { DeleteCriteria, ReadCriteria, UpdateCriteria } from 'mega-nice-criteria'
import Log from 'mega-nice-log'
import sql, { Query } from 'mega-nice-sql'
import { fillCreateCriteria, fillDeleteCriteria, fillUpdateCriteria } from 'mega-nice-sql-criteria-filler'
import { rowToDeleteCriteria, rowToUpdateCriteria } from './criteriaTools'
import { buildSelectQuery } from './queryTools'
import { filterValidColumns, idsOnly, unjoinRows } from './rowTools'
import { getRelationshipNameByColumn, Schema } from './Schema'
import { FiddledRows } from './util'

let log = new Log('mega-nice-sql-orm/isud.ts')

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

  let alreadyInsertedRow = alreadyInsertedRows.getByRow(tableName, row)
  if (alreadyInsertedRow != undefined) {
    l.debug('Row already inserted. Returning already inserted row...', alreadyInsertedRow)
    return alreadyInsertedRow
  }
  else {
    if (alreadyInsertedRows.containsRow(tableName, row)) {
      l.debug('Row is already inserted up in the recursion chain...')
    }
  }

  alreadyInsertedRows.add(tableName, row)

  let table = schema[tableName]
  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  // check if the row has all the id's it could have and try to do something about it if not
  l.debug('Inserting missing many-to-one and one-to-one relationships first to be able to assign their id\'s before inserting the actual row...')
  for (let columnName of Object.keys(table.columns)) {
    let relationshipName = getRelationshipNameByColumn(table, columnName)

    // the column is part of a relationship and its id is missing
    if (table.relationships != undefined && relationshipName != undefined && row[columnName] == undefined) {
      let relationship = table.relationships[relationshipName]

      if (relationship == undefined) {
        throw new Error(`Relationship '${relationshipName}' not contained table '${tableName}'`)
      }
      
      // if the relationship is a many-to-one and this entity thus needs its id
      if (relationship.manyToOne || relationship.oneToOne != undefined) {
        l.debug(`Trying to determine id for '${columnName}'`, relationship)

        let column = table.columns[relationship.thisId]
        if (column == undefined) {
          throw new Error(`Column '${relationship.thisId}' not contained in table '${tableName}'`)
        }

        // otherwise check if there is a row object appended for the relationship. if so insert that one
        // first and then take the id from there
        if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
          l.debug('There is a row object for that relationship. Insert it first...', row[relationshipName])

          if (alreadyInsertedRows.containsRow(relationship.otherTable, row[relationshipName])) {
            let alreadyInsertedRow = alreadyInsertedRows.getByRow(relationship.otherTable, row[relationshipName])
  
            if (alreadyInsertedRow != undefined) {
              l.debug('Using id from already inserted row', alreadyInsertedRow)
              row[columnName] = alreadyInsertedRow[relationship.otherId]
            }
            else {
              l.debug('Row is about to be inserted somewhere up the recursion chain. Continuing...')
            }
          }
          else {
            l.debug('Inserting the row object of the relationship. Going into recursion...')
            let relationshipRow = await insert(schema, relationship.otherTable, db, queryFn, row[relationshipName], alreadyInsertedRows)
            l.debug('Returning from recursion...')
            l.debug('Using id from just inserted relationship...', relationshipRow)
            row[columnName] = relationshipRow[relationship.otherId]
          }
        }
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
  
  alreadyInsertedRows.setResult(row, insertedRow)
  l.debug('Setting result on alreadyInsertedRows', alreadyInsertedRows.fiddledRows)

  l.debug('Insert remaining relationships...')

  if (table.relationships != undefined) {
    for (let relationshipName of Object.keys(table.relationships)) {
      l.debug('Trying to insert relationship', relationshipName)
      
      let relationship = table.relationships[relationshipName]
      let column = table.columns[relationship.thisId]

      if (column == undefined) {
        throw new Error(`Column '${relationship.thisId}' not contained in table '${tableName}'`)
      }
  
      // if the relationship is a one-to-one insert it
      if (relationship.oneToOne != undefined) {
        l.debug('Relationship is one-to-one. Trying to determine already inserted other end of the relationship and set the id from it...')
  
        // get the table of the relationship
        let otherRelationshipTable = schema[relationship.otherTable]

        if (otherRelationshipTable == undefined) {
          throw new Error('Table not contained in schema: ' + relationship.otherTable)
        }

        if (otherRelationshipTable.relationships == undefined) {
          throw new Error(`Relationship '${relationship.oneToOne} not contained table '${relationship.otherTable}'`)
        }

        let otherRelationship = otherRelationshipTable.relationships[relationship.oneToOne]
  
        l.debug('otherRelationship', otherRelationship)
  
        if (otherRelationship == undefined) {
          throw new Error(`Relationship '${relationship.oneToOne} not contained table '${relationship.otherTable}'`)
        }
  
        let otherRelationshipRow = alreadyInsertedRows.getByTableNameAndId(relationship.otherTable, relationship.otherId, insertedRow[relationship.thisId])
  
        if (otherRelationshipRow != undefined) {
          l.debug('Found already inserted row if relationship. Setting id...', otherRelationshipRow)
          
          let idsOnlyRow = idsOnly(otherRelationshipTable, otherRelationshipRow)
          idsOnlyRow[otherRelationship.thisId] = insertedRow[otherRelationship.otherId]
          l.debug('idsOnlyRow', idsOnlyRow)
  
          let updateCriteria = rowToUpdateCriteria(schema, otherRelationship.otherTable, idsOnlyRow)
          l.debug('updateCriteria', updateCriteria)
  
          let updatedOtherRelationshipRows = await update(schema, otherRelationship.otherTable, db, queryFn, updateCriteria)
          l.debug('updatedOtherRelationshipRows', updatedOtherRelationshipRows)
  
          if (updatedOtherRelationshipRows.length != 1) {
            throw new Error('Expected row count does not equal 1')
          }
    
          insertedRow[relationshipName] = updatedOtherRelationshipRows[0]
        }
        else {
          l.debug('Could not determine the row of the one-to-one relationship')
        }
  
      }
      // we already inserted that particular row object and now we just want to set it on the resulting insertedRow object
      else if (alreadyInsertedRows.containsRow(tableName, row[relationshipName])) {
        let alreadyInsertedRow = alreadyInsertedRows.getByRow(relationship.otherTable, row[relationshipName])
  
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
      else if (row[relationshipName] != undefined) {
        l.debug('Relationship is present in the given row', relationship)
  
        if (row[relationshipName] instanceof Array) {
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
              
              if (insertedRelationshipRow != undefined) {
                if (insertedRow[relationshipName] == undefined) {
                  insertedRow[relationshipName] = []
                }
    
                l.debug('Pushing inserted relationship row into array on inserted row...')
                insertedRow[relationshipName].push(insertedRelationshipRow)
              }  
            }
            else {
              l.debug('That particular row object is already being inserted up the recursion chain. Continuing...')
            }
          }
        }
        else {
          l.debug('No supported relationship type. Was neither many-to-one nor one-to-many nor one-to-one. Continuing...')
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