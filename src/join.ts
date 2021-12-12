import { Criteria, summarizeCriteria } from 'knight-criteria'
import { Log } from 'knight-log'
import { objectsRepresentSameEntity } from './row'
import { Relationship, Table } from './schema'

let log = new Log('knight-orm/join.ts')

let joinAliasLogger = log.cls('JoinAlias')

export class JoinAlias {
  rootTable: Table
  parent: JoinAlias|null
  relationship: Relationship|null
  
  private _alias?: string
  private _joinAlias?: string
  private _columnAlias?: string

  constructor(table: Table)
  constructor(parent: JoinAlias, relationship: Relationship)

  constructor(...args: any[]) {
    if (args.length == 1) {
      let arg1 = args[0]

      if (arg1 instanceof Table) {
        this.rootTable = arg1
        this.parent = null
        this.relationship = null
      }
      else {
        throw new Error('Expected first parameter to be of instance \'Table\'.')
      }
    }
    else if (args.length == 2) {
      let arg1 = args[0]
      let arg2 = args[1]

      if (arg1 instanceof JoinAlias && arg2 instanceof Relationship) {
        this.rootTable = arg1.table
        this.parent = arg1
        this.relationship = arg2
      }
      else {
        throw new Error('Expected first parameter to be of instance \'JoinAliasSchema\' and second to be of instance \'Relationship\'.')
      }
    }
    else {
      throw new Error('Invalid parameter count.')
    }
  }

  get table(): Table {
    if (this.relationship) {
      return this.relationship.otherTable
    }

    return this.rootTable
  }

  get alias(): string {
    if (! this._alias) {
      if (this.parent && this.relationship) {
        this._alias = this.parent.alias + '__' + this.relationship.name
      }
      else {
        this._alias = this.rootTable.name
      }
    }

    return this._alias
  }

  get joinAlias(): string {
    if (! this._joinAlias) {
      this._joinAlias = this.alias + '.'
    }

    return this._joinAlias
  }

  get columnAlias(): string {
    if (! this._columnAlias) {
      this._columnAlias = this.alias + '__'
    }

    return this._columnAlias
  }

  join(relationship: Relationship): JoinAlias {
    let relationshipAliasSchema = new JoinAlias(this, relationship)
    return relationshipAliasSchema
  }

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
  unjoinTable(joinedRow: any, returnUndefinedIfEveryColumnIsNull = false): any {
    let unjoinedRow: any = undefined
    let everyColumnIsNull = true

    for (let column of this.table.columns) {
      let aliasedColumn = this.columnAlias + column.name

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
  unjoinRows(joinedRows: any[], criteria: Criteria, asDatabaseCriteria: boolean): any[]  {
    let l = joinAliasLogger.fn('unjoinRows')

    l.param('criteria', criteria)
    l.param('asDatabaseCriteria', asDatabaseCriteria)

    l.location = [ this.columnAlias ]
    l.locationSeparator = ' > '

    let relationshipToObjects: { [relationshipName: string]: any[] } = {}

    let summarizedCriteria = summarizeCriteria(criteria)
    l.lib('Summarized criteria', summarizedCriteria)

    if (this.table.relationships.length > 0) {
      l.lib('Unjoining relationships...')
    }

    l.location.push('')

    for (let relationship of this.table.relationships) {
      l.location.pop()
      l.location.push(relationship.name)

      l.lib('Unjoining relationship', relationship.name)

      if (! (relationship.name in summarizedCriteria)) {
        l.lib('Relationship is not contained in criteria. Continuing...')
        continue
      }

      if (summarizedCriteria[relationship.name]['@load'] !== true) {
        l.lib('Relationship is not to be loaded. Skipping...')
        continue
      }

      let relationshipJoinAlias = this.join(relationship)

      l.calling('Fetching all relationship rows. Calling unjoinRows again...')
      let relationshipObjects = relationshipJoinAlias.unjoinRows(
        joinedRows, 
        summarizedCriteria[relationship.name], 
        asDatabaseCriteria
      )
      l.called('Returning from fetching all relationship rows...')
      
      l.dev('Found relationship objects', relationshipObjects)
      relationshipToObjects[relationship.name] = relationshipObjects

      l.lib('Continuing unjoining relationships...')
    }

    l.location.pop()

    if (this.table.relationships.length > 0) {
      l.lib('Finished unjoining relationships. Continuing with unjoining every row...')
    }
    else {
      l.lib('Unjoining rows...')
    }

    let unjoinedObjs: any[] = []

    for (let joinedRow of joinedRows) {
      l.lib('Unjoining next row', joinedRow)

      let unjoinedRow = this.unjoinTable(joinedRow, true)

      if (unjoinedRow == undefined) {
        l.lib('Given joined row did not contain any columns of the given table or every value was null. Skipping...')
        continue
      }

      l.lib('Unjoined row', unjoinedRow)

      let unjoinedObj
      if (asDatabaseCriteria) {
        unjoinedObj = unjoinedRow
      }
      else {
        unjoinedObj = this.table.rowToInstance(unjoinedRow)
        l.lib('Converted row to instance', unjoinedObj)
      }

      let objAlreadyUnjoined = false
      for (let alreadyUnjoinedRow of unjoinedObjs) {
        if (objectsRepresentSameEntity(this.table, alreadyUnjoinedRow, unjoinedObj, asDatabaseCriteria)) {
          objAlreadyUnjoined = true
          break
        }
      }

      if (objAlreadyUnjoined) {
        l.lib('Not adding unjoined object to result array because it was already added')
      }
      else {
        l.lib('Adding unjoined object to the result array')
        unjoinedObjs.push(unjoinedObj)
      }

      let relationshipNames = Object.keys(relationshipToObjects)
      if (this.table.relationships.length > 0) {
        l.lib('Adding relationships...')
      }

      l.location.push('')
      for (let relationshipName of relationshipNames) {
        l.location.pop()
        l.location.push(relationshipName)

        let relationship = this.table.getRelationship(relationshipName)

        l.lib('Adding objects for relationship', relationship.name)

        if (relationship.manyToOne) {
          l.dev('Relationship is many-to-one. Initializing property with null.')
          unjoinedObj[relationship.name] = null
        }
        else if (relationship.oneToMany) {
          l.dev('Relationship is one-to-many. Initializing property with empty array.')
          unjoinedObj[relationship.name] = []
        }

        l.dev('Iterating through every relationshop object...')

        for (let relationshipObj of relationshipToObjects[relationship.name]) {
          if (unjoinedObj[relationship.thisId.getName(asDatabaseCriteria)] === relationshipObj[relationship.otherId.getName(asDatabaseCriteria)]) {
            if (relationship.manyToOne) {
              l.lib('Setting many-to-one', relationshipObj)
              unjoinedRow[relationship.name] = relationshipObj
              break
            }

            else if (relationship.oneToMany) {
              l.lib('Adding one-to-many', relationshipObj)
              unjoinedRow[relationship.name].push(relationshipObj)
            }
          }

          else {
            l.dev('Relationship object was not related', relationshipObj)
          }
        }

        if (relationship.manyToOne && unjoinedObj[relationship.name] === null) {
          l.lib('No relationship object was found (many-to-one)')
        }
        else if (relationship.oneToMany && unjoinedObj[relationship.name].length == 0) {
          l.lib('No relationship objects were found (one-to-many)')
        }
      }

      l.location.pop()
    }

    l.returning('Returning unjoined objects...', unjoinedObjs)
    return unjoinedObjs
  }
}
