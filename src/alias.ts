import { Criteria, summarizeCriteria } from 'knight-criteria'
import { Log } from 'knight-log'
import { ObjectTools } from '.'
import { Column, Relationship, Table } from './schema'

let log = new Log('knight-orm/alias.ts')

let joinAliasLogger = log.cls('Alias')

/**
 * A class for creating an alias when joining tables in an SQL query.
 * 
 * The initial Alias instance creates a root alias for the table
 * which is stated in an SQL FROM clause. If the table name is 'user'
 * then the resulting alias is 'user'.
 * 
 * Based on the root alias, arbitrary join aliases can be created by
 * using the method 'join'. If you join the relationship 'address', then
 * the resulting alias will be 'user__address'.
 * 
 * The properties 'joinAlias' and 'columnAlias' then can be used when
 * aliasing a joined a table or when aliasing a selected column.
 * 
 * The method 'unjoinRows' will create an object tree out of a given
 * database result which can contain arbitrary joined columns. It is
 * important, that the column where aliased in the SQL SELECT clause
 * using the 'columnAlias' property of this class. This is the key
 * for unjoining rows.
 */
export class Alias {

  /**
   * The table as it was stated in the FROM clause.
   */
  rootTable: Table

  /**
   * A parent Alias instance or null if it is the root alias.
   */
  parent: Alias|null

  /**
   * The relationship for which the instance create an alias for.
   */
  relationship: Relationship|null
  
  private _aliasPrefix?: string
  private _joinAliasPrefix?: string
  private _columnAliasPrefix?: string

  /**
   * This constructor is used to create the initial root alias which
   * is the base for all following join aliases.
   * 
   * @param rootTable The table which was defined in the SQL FROM clause
   */
  constructor(rootTable: Table)

  /**
   * This constructor is used for creating a join alias, either using
   * the root alias as its base or any join alias.
   * 
   * @param parent Any Alias instance
   * @param relationship The relationship which is joined
   */
  constructor(parent: Alias, relationship: Relationship)

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

      if (arg1 instanceof Alias && arg2 instanceof Relationship) {
        this.rootTable = arg1.rootTable
        this.parent = arg1
        this.relationship = arg2
      }
      else {
        throw new Error('Expected first parameter to be of instance \'AliasSchema\' and second to be of instance \'Relationship\'.')
      }
    }
    else {
      throw new Error('Invalid parameter count.')
    }
  }

  /**
   * Either the table which was given as the base or the other table of the given 
   * relationship.
   */
  get table(): Table {
    if (this.relationship) {
      return this.relationship.otherTable
    }

    return this.rootTable
  }

  get rootTableAlias(): string {
    return 't'
  }

  /**
   * The alias which contains all the aliases from all parents, concatenated by 
   * a double underscore.
   */
  get aliasPrefix(): string {
    if (! this._aliasPrefix) {
      if (this.parent && this.relationship) {
        this._aliasPrefix = this.parent.aliasPrefix + '__' + this.relationshipAlias
      }
      else {
        this._aliasPrefix = this.rootTableAlias
      }
    }

    return this._aliasPrefix
  }

  get relationshipAlias(): string {
    return this.relationship ? this.relationship.table.relationships.indexOf(this.relationship).toString() : ''
  }

  getColumnAlias(column: Column): string {
    return column.table.columns.indexOf(column).toString()
  }

  /** 
   * The alias for usage in an SQL query when aliasing the joined table. It
   * is the 'alias' property with an appended dot.
   */
  get joinAliasPrefix(): string {
    if (! this._joinAliasPrefix) {
      this._joinAliasPrefix = this.aliasPrefix + '.'
    }

    return this._joinAliasPrefix
  }

  /** 
   * The alias for usage in an SQL query when creating an aliasing a column in a 
   * select statement. It is the 'alias' property with appended double underscore.
   */
  get columnAliasPrefix(): string {
    if (! this._columnAliasPrefix) {
      this._columnAliasPrefix = this.aliasPrefix + '_'
    }

    return this._columnAliasPrefix
  }

  /**
   * Create a new Alias instance by joining a new relationship. The source
   * relationship will be refered by this new instance as the parent. The alias
   * property will contain the parent alias.
   * 
   * @param relationship The relationship to join
   * @returns A new Alias instance representing the alias for the joined relationship
   */
  join(relationship: Relationship): Alias {
    return new Alias(this, relationship)
  }

  /**
   * Gets a row consisting of multiple joined tables and unjoins a given table. It basically
   * means that it will extract the columns of the given table while removing their aliases.
   * 
   * @param joinedRow A row which contains columns of multiple joined tables
   * @param returnUndefinedIfEveryColumnIsNull Return undefined if every column is null
   * @returns An object which has only those properties who represent the columns of the given table. If the row did not contain any column of the given table, undefined is returned.
   */
  unjoinTable(joinedRow: any, returnUndefinedIfEveryColumnIsNull = false): any {
    let unjoinedRow: any = undefined
    let everyColumnIsNull = true

    for (let column of this.table.columns) {
      let aliasedColumn = this.columnAliasPrefix + this.getColumnAlias(column)

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
   * @param joinedRows A array of row objects containing root columns and joined columns
   * @param criteria The criteria which were used to create the given rows
   * @param asDatabaseCriteria The given criteria denote database columns
   * @returns An array of objects with relationship objects
   */
  unjoinRows(joinedRows: any[], criteria: Criteria, asDatabaseCriteria = false): any[]  {
    let l = joinAliasLogger.mt('unjoinRows')

    l.param('criteria', criteria)
    l.param('asDatabaseCriteria', asDatabaseCriteria)

    l.location = [ this.columnAliasPrefix ]
    l.locationSeparator = ' > '

    // Kind of a hacky approach to be able to use one the functions which
    // do not need any of vaules given by the parameters of the constructor.
    // There might be a better solution in the future.
    let objectTools = new ObjectTools(undefined as any)

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

      let relationshipAlias = this.join(relationship)

      l.calling('Fetching all relationship rows. Calling unjoinRows again...')
      let relationshipObjects = relationshipAlias.unjoinRows(
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
        if (objectTools.objectsRepresentSameEntity(this.table, alreadyUnjoinedRow, unjoinedObj, asDatabaseCriteria)) {
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

        l.dev('Searching for relationshop objects...')

        for (let relationshipObj of relationshipToObjects[relationship.name]) {
          if (unjoinedObj[relationship.thisId.getName(asDatabaseCriteria)] === relationshipObj[relationship.otherId.getName(asDatabaseCriteria)]) {
            if (relationship.manyToOne) {
              l.lib('Found and setting many-to-one', relationshipObj)
              unjoinedObj[relationship.name] = relationshipObj
              break
            }

            else if (relationship.oneToMany) {
              l.lib('Found and adding one-to-many', relationshipObj)
              unjoinedObj[relationship.name].push(relationshipObj)
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
