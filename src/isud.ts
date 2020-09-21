import { ReadCriteria } from 'mega-nice-criteria'
import sql from 'mega-nice-sql'
import { fillCreateCriteria, fillDeleteCriteria, fillReadCriteria, fillUpdateCriteria } from 'mega-nice-sql-criteria-filler'
import { rowToDeleteCriteria, rowToUpdateCriteria } from './criteriaTools'
import { buildSelectQuery } from './queryTools'
import { idsOnly } from './rowTools'
import { getRelationshipNameByColumn, getRelationshipNames, isId, Relationship, Schema } from './Schema'

class FiddledRows {
  fiddledRows: { tableName: string, row: any, fiddledRow?: any }[] = []

  add(tableName: string, row: any, fiddledRow?: any) {
    this.fiddledRows.push({ tableName: tableName, row: row, fiddledRow: fiddledRow })
  }

  setFiddledRow(row: any, fiddledRow: any) {
    let existingFiddledRow = undefined
    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.row === row) {
        existingFiddledRow = fiddledRow
      }
    }

    if (existingFiddledRow == undefined) {
      throw new Error('Could not set fiddled row because the row object was not already fiddled with')
    }

    existingFiddledRow.fiddledRow = fiddledRow
  }

  containsTableName(tableName: string): boolean {
    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.tableName === tableName) {
        return true
      }
    }
    return false
  }

  containsRow(row: any): boolean {
    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.row === row) {
        return true
      }
    }

    return false
  }

  getByRow(row: any): any | undefined {
    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.row === row) {
        return fiddledRow.fiddledRow
      }
    }
  }

  getByTableNameAndId(tableName: string, idColumnName: string, idColumnValue: any): any | undefined {
    for (let fiddledRow of this.fiddledRows) {
      if (fiddledRow.tableName == tableName && fiddledRow.fiddledRow != undefined) {
        if (fiddledRow.fiddledRow[idColumnName] == idColumnValue) {
          return fiddledRow.fiddledRow
        }
      }
    }
  }
}

export async function insert(
      schema: Schema, 
      tableName: string, 
      db: string, 
      queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, row: any, 
      alreadyInsertedRows: FiddledRows = new FiddledRows,
      insertedRow?: any,
      insertedRowIntoTableName?: string
    ): Promise<any> {
  // console.debug('Entering insert...')
  // console.debug('tableName', tableName)
  // console.debug('db', db)
  // console.debug('row', row)
  // console.debug('alreadyInsertedRows', alreadyInsertedRows.fiddledRows)
  // console.debug('insertedRow', insertedRow)
  // console.debug('insertedRowIntoTableName', insertedRowIntoTableName)

  let alreadyInsertedRow = alreadyInsertedRows.getByRow(row)
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
    if (relationshipName != undefined && row[columnName] == undefined) {
      let relationship = table[relationshipName] as Relationship
      
      // if the relationship is a many-to-one and this entity thus needs its id
      if (relationship.manyToOne || relationship.oneToOne != undefined) {
        // console.debug('Found empty id', columnName)
        // console.debug('relationship', relationship)

        // at first check if the given inserted row is the one of the relationship and if so use 
        // the id from there
        if (relationship.otherTable == insertedRowIntoTableName && isId(table.columns[relationship.thisId])) {
          // console.debug('The relationship was just inserted before. Retrieving id from given insertedRow', insertedRow)
          row[columnName] = insertedRow[relationship.otherId]
        }
        // otherwise check if there is a row object appended for the relationship. if so insert that one
        // first and then take the id from there
        else if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
          // console.debug('There is a row object for that relationship', row[relationshipName])

          if (alreadyInsertedRows.containsRow(row[relationshipName])) {
            // console.debug('Row was already inserted or is about to be inserted')
            let alreadyInsertedRow = alreadyInsertedRows.getByRow(row[relationshipName])
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
  
  alreadyInsertedRows.setFiddledRow(row, insertedRow)
  // console.debug('alreadyInsertedRows', alreadyInsertedRows.fiddledRows)

  // console.debug('Insert remaining relationships...')

  for (let relationshipName of getRelationshipNames(table)) {
    // console.debug('relationshipName', relationshipName)
    let relationship = table[relationshipName] as Relationship

    // if the relationship leads back to were we are coming from continue
    if (relationship.otherTable == insertedRowIntoTableName && isId(table.columns[relationship.thisId])) {
      // console.debug('Relationship is the source. Continuing...')
      continue
    }
    // if the relationship is a one-to-one insert it
    else if (relationship.oneToOne != undefined) {
      // console.debug('Relationship is one-to-one')

      // get the table of the relationship
      let otherRelationshipTable = schema[relationship.otherTable]
      let otherRelationship = otherRelationshipTable[relationship.oneToOne] as Relationship

      // console.debug('otherRelationshipTable', otherRelationshipTable)
      // console.debug('otherRelationship', otherRelationship)

      if (otherRelationship == undefined) {
        throw new Error('Relationship not contained in table: ' + relationship.oneToOne)
      }

      let otherRelationshipRow = alreadyInsertedRows.getByTableNameAndId(relationship.otherTable, relationship.otherId, insertedRow[relationship.thisId])

      if (otherRelationshipRow != undefined) {
        // console.debug('otherRelationshipRow', otherRelationshipRow)
        let idsOnlyRow = idsOnly(otherRelationshipTable, otherRelationshipRow)
        idsOnlyRow[otherRelationship.thisId] = insertedRow[otherRelationship.otherId]
        let updatedOtherRelationshipRow = await update(schema, otherRelationship.otherTable, db, queryFn, idsOnlyRow)
  
        insertedRow[relationshipName] = updatedOtherRelationshipRow
      }
      else {
        // console.debug('Could not determine the row of the one-to-one relationship now')
      }

    }
    // we already inserted that particular row object and now we just want to set it on the resulting insertedRow object
    else if (alreadyInsertedRows.containsRow(row[relationshipName])) {
      let alreadyInsertedRow = alreadyInsertedRows.getByRow(row[relationshipName])
      if (alreadyInsertedRow != undefined) {
        insertedRow[relationshipName] = alreadyInsertedRow
      }

      // console.debug('Set inserted relationship row on the resulting insertedRow object')
      continue
    }    
    // otherwise we just insert the relationship
    else if (row[relationshipName] != undefined) {
      // console.debug('Relationship is present in the given row', relationship)

      // if (relationship.manyToOne) {
        // console.debug('Many-to-one relationship. Inserting row. Going into recursion...')
      //   let insertedRelationshipRow = await insert(schema, relationship.otherTable, db, queryFn, row[relationshipName], alreadyInsertedRows, insertedRow, tableName)
        // console.debug('Returning from recursion...')
      //   insertedRow[relationshipName] = insertedRelationshipRow
      // }
      if (row[relationshipName] instanceof Array) {
        // console.debug('One-to-many relationship. Inserting all rows...')
        
        for (let relationshipRow of row[relationshipName]) {
          // console.debug('relationshipRow', relationshipRow)

          if (! alreadyInsertedRows.containsRow(relationshipRow)) {
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

  let rows = await queryFn(sqlString, values)

  return rows
}

export async function update(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, row: any, allUpdatedRows: FiddledRows = new FiddledRows): Promise<any> {
  // console.debug('Entering update...')
  // console.debug('row', row)
  // console.debug('allUpdatedRows', allUpdatedRows)

  if (allUpdatedRows.containsRow(row)) {
    let alreadyUpdatedRow = allUpdatedRows.getByRow(row)
    // console.debug('Row object was already inserted. Returning already row...', alreadyUpdatedRow!.fiddledRow)
    return alreadyUpdatedRow
  }

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let criteria = rowToUpdateCriteria(row, table)
  // console.debug('criteria', criteria)

  let updatedRow = undefined

  if (Object.keys(criteria.set).length > 0) {
    let query = sql.update(tableName)
    fillUpdateCriteria(query, criteria, Object.keys(table.columns))
  
    if (db == 'postgres') {
      query.returning('*')
    }
  
    let sqlString = query.sql(db)
    let values = query.values()
  
    // console.debug('sqlString', sqlString)
    // console.debug('values', values)
  
    let rows = await queryFn(sqlString, values)
  
    if (rows.length != 1) {
      throw new Error('Expected row count does not equal 1')
    }
  
    updatedRow = rows[0]
    // console.debug('updatedRow', updatedRow)
  }
  else {
    // console.debug('No column to set given. Loading entity...')
    // remove the set property from the criteria to only have left the ids for selecting
    delete (criteria as any).set

    let query = sql.select('*').from(tableName)
    fillReadCriteria(query, criteria, Object.keys(table.columns))

    let sqlString = query.sql(db)
    let values = query.values()

    let selectedRows = await queryFn(sqlString, values)

    if (selectedRows.length != 1) {
      throw new Error('Expected row count does not equal 1')
    }

    updatedRow = selectedRows[0]
  }

  allUpdatedRows.add(tableName, row, updatedRow)
  
  // console.debug('Update relationships...')

  for (let relationshipName of getRelationshipNames(table)) {
    // console.debug('relationshipName', relationshipName)

    if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
      let relationship = table[relationshipName] as Relationship

      if (relationship.manyToOne) {
        // console.debug('Many-to-one relationship')
        // console.debug('Updating. Going into recursion...')
        let updatedRelationshipRow = await update(schema, relationship.otherTable, db, queryFn, row[relationshipName], allUpdatedRows)
        // console.debug('Coming back from recursion...')
        updatedRow[relationshipName] = updatedRelationshipRow
      }
      else if (row[relationshipName] instanceof Array) {
        // console.debug('One-to-many relationship. Iterating through all relationhip rows...')
        updatedRow[relationshipName] = []

        for (let relationshipRow of row[relationshipName]) {
          // console.debug('Updating. Going into recursion...')
          let updatedRelationshipRow = await update(schema, relationship.otherTable, db, queryFn, relationshipRow, allUpdatedRows)
          // console.debug('Coming back from recursion...')            
          updatedRow[relationshipName].push(updatedRelationshipRow)
        }
      }
      else {
        // console.debug('Was neither a many-to-one relationship nor was the correspinding object of type Array')
      }
    }
    else {
      // console.debug('Relationship is not of type object or null. Continuing...')
    }
  }

  return updatedRow
}

export async function delete_(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, row: any): Promise<void> {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  // at first delete all relationships who want to be deleted
  for (let relationshipName of getRelationshipNames(table)) {
    let relationship = table[relationshipName] as Relationship

    if (relationship.delete) {
      // await delete_(schema, relationship.otherTable, db, queryFn, )
    }
  }

  let criteria = rowToDeleteCriteria(row, table)

  let query = sql.deleteFrom(tableName)
  fillDeleteCriteria(query, criteria, Object.keys(table.columns))

  let sqlString = query.sql(db)
  let values = query.values()

  // console.debug('sqlString', sqlString)
  // console.debug('values', values)

  let rows = await queryFn(sqlString, values)

  if (rows.length != 1) {
    throw new Error('Expected row count does not equal 1')
  }

  let deletedRow = rows[0]

  return deletedRow
}