import { ReadCriteria } from 'mega-nice-criteria'
import sql from 'mega-nice-sql'
import { fillCreateCriteria, fillDeleteCriteria, fillUpdateCriteria } from 'mega-nice-sql-criteria-filler'
import { rowToDeleteCriteria, rowToUpdateCriteria } from './criteriaTools'
import { buildSelectQuery } from './queryTools'
import { idsOnly, rowsToInstances } from './rowTools'
import { getRelationshipNameByColumn, getRelationshipNames, Relationship, Schema } from './Schema'

class InserterdRows {
  rows: { tableName: string, row: any, insertedRow: any }[] = []

  add(tableName: string, row: any, insertedRow: any) {
    this.rows.push({ tableName: tableName, row: row, insertedRow: insertedRow })
  }

  containsTableName(tableName: string): boolean {
    for (let insertedRow of this.rows) {
      if (insertedRow.tableName === tableName) {
        return true
      }
    }
    return false
  }

  containsRow(row: any): boolean {
    return this.getByRow(row) != undefined
  }

  getByRow(row: any): { tableName: string, row: any, insertedRow: any } | undefined {
    for (let insertedRow of this.rows) {
      if (insertedRow.row === row) {
        return insertedRow
      }
    }
  }
}

export async function insert(
      schema: Schema, 
      tableName: string, 
      db: string, 
      queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, row: any, 
      alreadyInsertedRows: InserterdRows = new InserterdRows,
      insertedRow?: any,
      insertedRowIntoTableName?: string
    ): Promise<any> {
  // console.debug('Entering insert...')
  // console.debug('tableName', tableName)
  // console.debug('db', db)
  // console.debug('row', row)
  // console.debug('allInsertedRows', allInsertedRows)
  // console.debug('insertedRow', insertedRow)
  // console.debug('insertedRowInTableName', insertedRowInTableName)

  let alreadyInsertedRow = alreadyInsertedRows.getByRow(row)
  if (alreadyInsertedRow != undefined) {
    // console.debug('Row already inserted. Returning already inserted row...', alreadyInsertedRow)
    return alreadyInsertedRow.insertedRow
  }

  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  // this one will be used when we try to find out an id which is still missing for which purpose we inserted
  // a relationship first which this variable represents. later on we want to check if the relationship might
  // also want to know the id of this inserted entity because it may be a one-to-one relationship.
  let insertedRelationships: { [relationshipName: string]: any } = {}

  // check if the row has all the id's it could have and try to do something about it if not
  // console.debug('Looking for empty id\'s of many-to-one relationships...')
  for (let columnName of Object.keys(table.columns)) {
    let relationshipName = getRelationshipNameByColumn(columnName, table)

    // the column is part of a relationship and its id is missing
    if (relationshipName != undefined && row[columnName] == undefined) {
      let relationship = table[relationshipName] as Relationship
      
      // if the relationship is a many-to-one which should be the case anyway because otherwise there would not
      // be a corresponding column with an id
      if (relationship.manyToOne) {
        // console.debug('Found empty id', columnName)

        // at first check if the given inserted row is the one of the relationship and if so use 
        // the id from there
        if (relationship.otherTable == insertedRowIntoTableName) {
          // console.debug('The relationship was just inserted before. Retrieving id from given insertedRow', insertedRow)
          row[columnName] = insertedRow[relationship.otherId]
        }
        // otherwise check if there is a row object appended for the relationship. if so insert that one
        // first and then take the id from there
        else if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
          // console.debug('There is a relationship object. Inserting that one first. Going into recursion...', row[relationshipName])
          let relationshipRow = await insert(schema, relationship.otherTable, db, queryFn, row[relationshipName], alreadyInsertedRows)
          // console.debug('Returning from recursion...')
          row[columnName] = relationshipRow[relationship.otherId]
          insertedRelationships[relationshipName] = relationshipRow
        }
        else {
          // console.debug('Relationship was neither inserted before nor was there a corresponding object on the row. Continuing...')
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
  // console.debug('sqlString', sqlString)
  let values = query.values()
  // console.debug('values', values)

  let insertedRows = await queryFn(sqlString, values)
  // console.debug('insertedRows', insertedRows)

  if (insertedRows.length != 1) {
    throw new Error('Expected row count does not equal 1')
  }

  insertedRow = insertedRows[0]

  alreadyInsertedRows.add(tableName, row, insertedRow)

  // console.debug('Insert remaining relationships...')

  for (let relationshipName of getRelationshipNames(table)) {
    // console.debug('relationshipName', relationshipName)
    let relationship = table[relationshipName] as Relationship

    // if the relationship leads back to were we are coming from continue
    if (relationship.otherTable == insertedRowIntoTableName) {
      console.log('Relationship is the source. Continuing...')
      continue
    }
    // if we already inserted the relationship because we needed its id we will also check
    // if the relationship wants this id too
    else if (relationshipName in insertedRelationships) {
      console.debug('Relationship was already inserted. Looking for one-to-one relationship...')

      // get the table of the relationship
      let insertedRelationshipRow = insertedRelationships[relationshipName]
      let insertedRelationship = table[relationshipName] as Relationship
      let insertedRelationshipTable = schema[insertedRelationship.otherTable]

      console.debug('insertedRelationshipRow', insertedRelationshipRow)
      console.debug('insertedRelationship', insertedRelationship)

      if (insertedRelationshipTable == undefined) {
        throw new Error('Table not contianed in schema: ' + insertedRelationship.otherTable)
      }

      console.debug('insertedRelationshipTable', insertedRelationshipTable)

      // go through all relationships of the relationship table and look if one refers to
      // the table of this function call
      console.debug('Looking for a relationship in inserted relationship that is missing the id...')
      for (let relationshipName of getRelationshipNames(insertedRelationshipTable)) {
        console.debug('relationshipName', relationshipName)
        let relationship = table[relationshipName] as Relationship

        // if the relationship is many-to-one and the other table is the same as the current table
        if (relationship.manyToOne && relationship.otherTable == tableName && insertedRow[relationship.otherId] === undefined) {
          let idsOnlyRow = idsOnly(insertedRelationshipTable, insertedRelationshipRow)
          idsOnlyRow[relationship.thisId] = insertedRow[relationship.otherId]
          await update(schema, insertedRelationship.otherTable, db, queryFn, idsOnlyRow)
        }
      }
    }
    // otherwise we just insert the relationship
    else if (row[relationshipName] != undefined) {
      // console.debug('Relationship is present in the given row', relationship)

      if (relationship.manyToOne) {
        // console.debug('Many-to-one relationship. Inserting row. Going into recursion...')
        await insert(schema, relationship.otherTable, db, queryFn, row[relationshipName], alreadyInsertedRows, insertedRow, tableName)
        // console.debug('Returning from recursion...')  
      }
      else if (row[relationshipName] instanceof Array) {
        // console.debug('One-to-many relationship. Inserting all rows...')
        
        for (let relationshipRow of row[relationshipName]) {
          // console.debug('Inserting relationshipRow. Going into Recursion...', relationshipRow)
          await insert(schema, relationship.otherTable, db, queryFn, relationshipRow, alreadyInsertedRows, insertedRow, tableName)
          // console.debug('Returning from recursion...')  
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
  let instances = rowsToInstances(schema, tableName, rows, criteria)

  return instances
}

export async function update(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, row: any): Promise<any> {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let criteria = rowToUpdateCriteria(row, table)

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

  let updatedRow = rows[0]

  for (let relationshipName of getRelationshipNames(table)) {
    if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
      let relationship = table[relationshipName] as Relationship
      await update(schema, relationship.otherTable, db, queryFn, row[relationshipName])
    }
  }

  return updatedRow
}

export async function delete_(schema: Schema, tableName: string, db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any[]>, row: any): Promise<void> {
  let table = schema[tableName]

  if (table == undefined) {
    throw new Error('Table not contained in schema: ' + tableName)
  }

  let criteria = rowToDeleteCriteria(row, table)

  let query = sql.deleteFrom(tableName)
  fillDeleteCriteria(query, criteria, Object.keys(table.columns))

  let sqlString = query.sql(db)
  let values = query.values()

  // console.debug('sqlString', sqlString)
  // console.debug('values', values)

  let rows = await queryFn(sqlString, values)

  for (let relationshipName of getRelationshipNames(table)) {
    if (typeof row[relationshipName] == 'object' && row[relationshipName] !== null) {
      let relationship = table[relationshipName] as Relationship
      await delete_(schema, relationship.otherTable, db, queryFn, row[relationshipName])
    }
  }
}