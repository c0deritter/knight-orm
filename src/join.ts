import { Criteria, summarizeCriteria } from 'knight-criteria'
import { Log } from 'knight-log'
import { objectsRepresentSameEntity } from '.'
import { Table } from './schema'

let log = new Log('knight-orm/row.ts')

/**
 * Gets a row consisting of multiple joined tables and unjoins a given table. It basically
 * means that it will extract the columns of the given table while removing their aliases.
 * 
 * @param table The table which is to be extracted from the given row
 * @param joinedRow A row which contains columns of multiple joined tables
 * @param alias The alias which was used to prefix every column of the given table
 * @returns An object which has only those properties who represent the columns of the given table.
 * If the row did not contain any column of the given table, undefined is returned.
 */
 export function unjoinTable(table: Table, joinedRow: any, alias?: string, returnUndefinedIfEveryColumnIsNull = false): any {
  let unjoinedRow: any = undefined
  let everyColumnIsNull = true

  for (let column of table.columns) {
    let aliasedColumn = alias != undefined && alias.length > 0 ? alias + column.name : column.name

    if (aliasedColumn in joinedRow) {
      if (unjoinedRow == undefined) {
        unjoinedRow = {}
      }

      unjoinedRow[column.name] = joinedRow[aliasedColumn]

      if (unjoinedRow[column.name] !== null) {
        everyColumnIsNull = false
      }
    }
  }

  if (returnUndefinedIfEveryColumnIsNull && everyColumnIsNull) {
    return
  }

  return unjoinedRow
}

/**
 * Gets an array of rows which contain the columns of the base table and optionally additional
 * joined columns which refer to the base table through a many-to-one or one-to-many
 * relationship. It will create the corresponding object tree out of it.
 * 
 * @param schema The database schema which must contain the given table name
 * @param tableName The name of the table which must be contained in the given database schema
 * @param joinedRows A array of row objects containing root columns and joined columns
 * @param criteria The criteria which were used to create the given rows
 * @param alias The alias which was prepended to the column names in regard to the given table
 * @returns An array of row objects which relationships are unjoined
 */
export function unjoinRows(table: Table, joinedRows: any[], criteria: Criteria, alias: string): any[]  {
  let l = log.fn('unjoinRows')

  l.param('table.name', table.name)
  l.param('criteria', criteria)
  l.param('alias', alias)

  l.location = [ alias, '' ]

  let relationshipToRows: { [relationshipName: string]: any[] } = {}

  let summarizedCriteria = summarizeCriteria(criteria)
  l.lib('Summarized criteria', summarizedCriteria)

  if (table.relationships.length > 0) {
    l.lib('Unjoining relationships...')
  }

  for (let relationship of table.relationships) {
    l.location[1] = '> ' + relationship.name

    l.lib('Unjoining relationship', relationship.name)

    if (! (relationship.name in summarizedCriteria)) {
      l.lib('Relationship is not contained in criteria. Continuing...')
      continue
    }

    if (summarizedCriteria[relationship.name]['@load'] !== true) {
      l.lib('Relationship is not to be loaded. Skipping...')
      continue
    }

    let relationshipAlias = alias + relationship.name + '__'

    l.calling('Fetching all relationship rows. Calling unjoinRows again...')
    let relationshipRows = unjoinRows(relationship.otherTable, joinedRows, summarizedCriteria[relationship.name], relationshipAlias)
    l.called('Returning from fetching all relationship rows...')
    
    l.dev('Found relationship rows', relationshipRows)
    relationshipToRows[relationship.name] = relationshipRows

    l.lib('Continuing unjoining relationships...')
  }

  l.location[1] = ''

  if (table.relationships.length > 0) {
    l.lib('Finished unjoining relationships. Continuing with unjoining every row...')
  }
  else {
    l.lib('Unjoining rows...')
  }

  let unjoinedRows: any[] = []

  for (let joinedRow of joinedRows) {
    l.lib('Unjoining next row', joinedRow)

    let unjoinedRow = unjoinTable(table, joinedRow, alias, true)

    if (unjoinedRow == undefined) {
      l.lib('Given joined row did not contain any columns of the given table or every value was null. Skipping...')
      continue
    }

    l.lib('Unjoined row', unjoinedRow)

    let rowAlreadyUnjoined = false
    for (let alreadyUnjoinedRow of unjoinedRows) {
      if (objectsRepresentSameEntity(table, alreadyUnjoinedRow, unjoinedRow, true)) {
        rowAlreadyUnjoined = true
        break
      }
    }

    if (rowAlreadyUnjoined) {
      l.lib('Not adding unjoined row to result array because it was already added')
    }
    else {
      l.lib('Adding unjoined row to the result array')
      unjoinedRows.push(unjoinedRow)
    }

    let relationshipNames = Object.keys(relationshipToRows)
    if (table.relationships.length > 0) {
      l.lib('Adding relationships...')
    }

    for (let relationshipName of relationshipNames) {
      l.location[1] = '> ' + relationshipName
      let relationship = table.getRelationship(relationshipName)

      l.lib('Adding relationship rows for relationship', relationship.name)

      if (relationship.manyToOne) {
        l.dev('Relationship is many-to-one. Initializing property with null.')
        unjoinedRow[relationship.name] = null
      }
      else if (relationship.oneToMany) {
        l.dev('Relationship is one-to-many. Initializing property with empty array.')
        unjoinedRow[relationship.name] = []
      }

      l.dev('Iterating through every relationshop row...')

      for (let relationshipRow of relationshipToRows[relationship.name]) {
        if (unjoinedRow[relationship.thisId.name] === relationshipRow[relationship.otherId.name]) {
          if (relationship.manyToOne) {
            l.lib('Setting many-to-one row', relationshipRow)
            unjoinedRow[relationship.name] = relationshipRow
            break
          }

          else if (relationship.oneToMany) {
            l.lib('Adding one-to-many row', relationshipRow)
            unjoinedRow[relationship.name].push(relationshipRow)
          }
        }

        else {
          l.dev('Relationship row was not related', relationshipRow)
        }
      }

      if (relationship.manyToOne && unjoinedRow[relationship.name] === null) {
        l.lib('No relationship row was found (many-to-one)')
      }
      else if (relationship.oneToMany && unjoinedRow[relationship.name].length == 0) {
        l.lib('No relationship rows were found (one-to-many)')
      }
    }

    l.location[1] = ''
  }

  l.returning('Returning unjoined rows...', unjoinedRows)
  return unjoinedRows
}
