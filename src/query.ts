import { Criteria, isCriteriaComparison, Operator } from 'knight-criteria'
import { Log } from 'knight-log'
import { comparison, Condition, From, Join, Query } from 'knight-sql'
import { JoinAlias, Orm, Table } from '.'
import { Schema } from './schema'

let log = new Log('knight-orm/query.ts')

export interface InsertUpdateDeleteResult {
  affectedRows: number
  insertId?: number
}

export type SelectResult = any[]

let queryToolsLog = log.cls('QueryTools')

export class QueryTools {
  orm: Orm

  constructor(orm: Orm) {
    this.orm = orm
  }

  get schema(): Schema {
    return this.orm.schema
  }

  get db(): string {
    return this.orm.db
  }

  async databaseIndependentQuery(
    queryFn: (sqlString: string, values?: any[]) => Promise<any>,
    sqlString: string,
    values?: any[],
    insertIdColumnName?: string
  ): Promise<InsertUpdateDeleteResult | SelectResult> {
  
    let l = queryToolsLog.mt('databaseIndependentQuery')
    l.param('sqlString', sqlString)
    l.param('values', values)
    l.param('insertIdColumnName', insertIdColumnName)
  
    let isInsert = sqlString.substring(0, 6).toUpperCase() == 'INSERT'
  
    if (isInsert && this.db == 'postgres') {
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
  
    l.dev(`Result of database '${this.db}'`, dbResult)
  
    if (sqlString.substring(0, 6).toUpperCase() == 'SELECT') {
      if (this.db == 'postgres') {
        if (! ('rows' in dbResult) || ! (dbResult.rows instanceof Array)) {
          throw new Error('Result returned by PostgeSQL did not contain a valid \'rows\'. Expected an array. Enable logging for more information.')
        }
    
        l.returning('Returning rows of SELECT', dbResult.rows)
        return dbResult.rows as SelectResult
      }
    
      if (this.db == 'mysql' || this.db == 'maria') {
        if (! (dbResult instanceof Array)) {
          throw new Error('Result returned by MySQL was not any array. Enable logging for more information.')
        }
    
        l.returning('Returning rows of SELECT', dbResult)
        return dbResult
      }
  
      throw new Error(`Database '${this.db}' not supported.`)
    }
  
    else {
      let affectedRows
  
      if (this.db == 'postgres') {
        if (! ('rowCount' in dbResult) || typeof dbResult.rowCount != 'number' || isNaN(dbResult.rowCount)) {
          throw new Error('Result returned by PostgeSQL did not contain a valid \'rowCount\'. Expected a number. Enable logging for more information.')
        }
    
        affectedRows = dbResult.rowCount
      }
    
      if (this.db == 'mysql' || this.db == 'maria') {
        if (! ('affectedRows' in dbResult) || typeof dbResult.affectedRows != 'number' || isNaN(dbResult.affectedRows)) {
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
  
      if (this.db == 'postgres') {
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
  
      if (this.db == 'mysql' || this.db == 'maria') {
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
  
      throw new Error(`Database '${this.db}' not supported.`)
    }
  }

  /**
   * Fill a knight-sql query with criteria.
   * 
   * @param table The table the criteria was created for
   * @param query A knight-sql query object
   * @param criteria The criteria
   * @param asDatabaseCriteria Set to true if the criteria reference database columns instead of object properties
   * @param joinAlias An internal parameter which is used to create the appropriate aliases for joined tables
   * @param sqlCondition An internal parameter which is a knight-sql condition that is used to sourround parts of the condition with brackets
   */
  addCriteria(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    query: Query, 
    criteria: Criteria | undefined, 
    asDatabaseCriteria = false, 
    joinAlias?: JoinAlias, 
    sqlCondition?: Condition
  ) {
    let l = queryToolsLog.mt('addCriteria')
    l.param('query', query)
    l.param('criteria', criteria)
    l.param('joinAlias', joinAlias)
    l.param('condition', sqlCondition)

    if (criteria == undefined) {
      l.returning('Criteria are undefined or null. Returning...')
      return
    }

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    if (joinAlias == undefined) {
      joinAlias = new JoinAlias(table)
    }

    if (sqlCondition == undefined) {
      if (query._where == undefined) {
        query._where = new Condition
        query._where.removeOuterLogicalOperators = true
      }

      sqlCondition = query._where
    }
    else {
      sqlCondition.removeOuterLogicalOperators = true
    }

    if (criteria instanceof Array) {
      l.lib('Given criteria is an array')

      let logical = 'OR'

      for (let arrayValue of criteria) {
        if (typeof arrayValue == 'string') {
          let upperCase = arrayValue.toUpperCase()

          if (upperCase == 'AND' || upperCase == 'OR' || upperCase == 'XOR') {
            logical = upperCase
            l.lib('Setting logical operator to', logical)
            continue
          }
        }

        l.lib('Adding logical operator', logical)
        sqlCondition.push(logical)

        let subCondition = new Condition
        subCondition.surroundWithBrackets = true
        sqlCondition.push(subCondition)

        l.calling('Add sub criteria through recursion', arrayValue)
        this.addCriteria(table, query, arrayValue as any, asDatabaseCriteria, joinAlias, subCondition)
        l.called('Added sub criteria through recursion')
      }
    }
    else if (typeof criteria == 'object' && criteria !== null) {
      l.lib('Given criteria is an object')

      if (criteria['@orderBy'] != undefined) {
        if (typeof criteria['@orderBy'] == 'string') {
          if (asDatabaseCriteria && table.hasColumn(criteria['@orderBy'])) {
            l.lib('Adding ORDER BY', criteria['@orderBy'])
            query.orderBy(joinAlias.joinAlias + criteria['@orderBy'])
          }
          else if (! asDatabaseCriteria && table.hasColumnByProperty(criteria['@orderBy'])) {
            let column = table.getColumnByProperty(criteria['@orderBy'])!
            l.lib(`Adding ORDER BY from property name '${criteria['@orderBy']}'`, column.name)
            query.orderBy(joinAlias.joinAlias + column.name)
          }
          else {
            l.lib('Not adding ORDER BY because the given column or property is not contained in the table', criteria['@orderBy'])
          }
        }
        else if (criteria['@orderBy'] instanceof Array) {
          l.lib('Found an array of ORDER BY conditions', criteria['@orderBy'])

          for (let orderBy of criteria['@orderBy']) {
            if (typeof orderBy == 'string') {
              if (asDatabaseCriteria && table.hasColumn(orderBy)) {
                l.lib('Adding ORDER BY', orderBy)
                query.orderBy(joinAlias.joinAlias + orderBy)
              }
              else if (! asDatabaseCriteria && table.hasColumnByProperty(orderBy)) {
                let column = table.getColumnByProperty(orderBy)!
                l.lib(`Adding ORDER BY from property name '${criteria['@orderBy']}'`, column.name)
                query.orderBy(joinAlias.joinAlias + column.name)
              }
              else {
                l.lib('Not adding ORDER BY because the given column or property is not contained in the table', orderBy)
              }    
            }
            else if (typeof orderBy == 'object') {
              if (typeof orderBy.field == 'string') {
                if (asDatabaseCriteria && ! table.hasColumn(orderBy.field)) {
                  l.lib('Not adding ORDER BY because the given column is not contained in the table', orderBy)
                  continue
                }

                if (! asDatabaseCriteria && ! table.hasColumnByProperty(orderBy.field)) {
                  l.lib('Not adding ORDER BY because the given property is not contained in the instance', orderBy)
                  continue
                }
    
                let direction: string|undefined = undefined
    
                if (typeof orderBy.direction == 'string') {
                  let upperCase = orderBy.direction.toUpperCase()
    
                  if (upperCase == 'ASC' || upperCase == 'DESC') {
                    direction = upperCase
                  }
                }

                let columnName
                if (asDatabaseCriteria) {
                  columnName = orderBy.field
                }
                else {
                  let column = table.getColumnByProperty(orderBy.field)!
                  columnName = column.name
                }
    
                if (direction == undefined) {
                  l.lib('Adding ORDER BY', columnName)
                  query.orderBy(joinAlias.joinAlias + columnName)
                }
                else {
                  l.lib('Adding ORDER BY', columnName)
                  query.orderBy(joinAlias.joinAlias + columnName + ' ' + direction)
                }  
              }
              else {
                l.lib('Not adding ORDER BY because the given field property is not of type object', orderBy)
              }
            }
            else {
              l.lib('Not adding ORDER BY because the given element was not neither a string nor an object', orderBy)
            }
          }
        }
        else if (typeof criteria['@orderBy'] == 'object') {
          if (typeof criteria['@orderBy'].field == 'string') {
            if (asDatabaseCriteria && table.hasColumn(criteria['@orderBy'].field) ||
                ! asDatabaseCriteria && table.hasColumnByProperty(criteria['@orderBy'].field)) {
              
                  let direction: string|undefined = undefined

              if (typeof criteria['@orderBy'].direction == 'string') {
                let upperCase = criteria['@orderBy'].direction.toUpperCase()
    
                if (upperCase == 'ASC' || upperCase == 'DESC') {
                  direction = upperCase
                }
              }
    
              let columnName
              if (asDatabaseCriteria) {
                columnName = criteria['@orderBy'].field
              }
              else {
                let column = table.getColumnByProperty(criteria['@orderBy'].field)!
                columnName = column.name
              }

              if (direction == undefined) {
                l.lib('Adding ORDER BY', columnName)
                query.orderBy(joinAlias.joinAlias + columnName)
              }
              else {
                l.lib('Adding ORDER BY', columnName)
                query.orderBy(joinAlias.joinAlias + columnName + ' ' + direction)
              }  
            }
            else {
              l.lib('Not adding ORDER BY because the given column or property is not contained in the table', criteria['@orderBy'])
            }
          }
          else {
            l.lib('Not adding ORDER BY because the given field \'property\' is not a string', criteria['@orderBy'])
          }
        }
        else {
          l.lib('Not adding ORDER BY because it was neither a string, an array nor an object', criteria['@orderBy'])
        }
      }

      if (query._limit == undefined && typeof criteria['@limit'] == 'number' && ! isNaN(criteria['@limit'])) {
        l.lib('Setting limit', criteria['@limit'])
        query._limit = criteria['@limit']
      }

      if (query._offset == undefined && typeof criteria['@offset'] == 'number' && ! isNaN(criteria['@offset'])) {
        l.lib('Setting offset', criteria['@offset'])
        query._offset = criteria['@offset']
      }

      if (criteria['@not'] === true) {
        sqlCondition.push('NOT')
        
        let negatedCondition = new Condition
        negatedCondition.removeOuterLogicalOperators = true
        negatedCondition.surroundWithBrackets = true

        sqlCondition.push(negatedCondition)
        sqlCondition = negatedCondition
      }

      l.lib('Iterating over all columns')

      for (let column of table.columns) {
        l.location = [column.getName(asDatabaseCriteria)]

        if (criteria[column.getName(asDatabaseCriteria)] === undefined) {
          l.lib('Skipping column or property because it is not contained in the given criteria')
          continue
        }

        let value: any = criteria[column.getName(asDatabaseCriteria)]
        l.lib('Processing column using criterium', value)

        l.lib('Adding logical operator AND')
        sqlCondition.push('AND')

        if (isCriteriaComparison(value)) {
          l.lib('Given object represents a comparison')

          let operator = value['@operator'].toUpperCase()

          if (! (operator in Operator)) {
            l.lib(`Operator '${operator}' is not supported. Continuing...`)
            continue
          }

          if (value['@value'] !== undefined) {
            let comp = comparison(joinAlias.joinAlias + column.name, operator, value['@value'])
            
            if (value['@not'] === true) {
              l.lib('Adding comparison with NOT', comp)
              sqlCondition.push('NOT', comp)
            }
            else {
              l.lib('Adding comparison', comp)
              sqlCondition.push(comp)
            }
          }
          else {
            l.lib('Not adding comparison because the value is undefined')
          }
        }

        else if (value instanceof Array) {
          l.lib('The given criterium is an array')

          let atLeastOneComparison = false

          for (let arrayValue of value) {
            if (isCriteriaComparison(arrayValue)) {
              atLeastOneComparison = true
              break
            }
          }

          if (! atLeastOneComparison) {
            let comp = comparison(joinAlias.joinAlias + column.name, value)
            l.lib('Adding comparison', comp)
            sqlCondition.push(comp)
          }
          else {
            l.lib('Array represents connected comparisons')

            let logical = 'OR'
            
            let subCondition = new Condition
            subCondition.removeOuterLogicalOperators = true
            subCondition.surroundWithBrackets = true
            sqlCondition.push(subCondition)

            for (let arrayValue of value) {
              if (typeof arrayValue == 'string') {
                let upperCase = arrayValue.toUpperCase()

                if (upperCase == 'AND' || upperCase == 'OR' || upperCase == 'XOR') {
                  logical = upperCase
                  l.lib('Setting logical operator to', logical)
                  continue
                }
              }

              if (isCriteriaComparison(arrayValue)) {
                if (arrayValue['@value'] === undefined) {
                  l.lib('Skipping comparison because its value is undefined', arrayValue)
                  continue
                }

                l.lib('Processing comparison', arrayValue)

                let operator = arrayValue['@operator'].toUpperCase()

                if (!(operator in Operator)) {
                  l.lib(`Comparison operator '${operator}' is not supported. Continuing...`)
                  continue
                }

                l.lib('Adding logical operator', logical)
                subCondition.push(logical)

                let comp = comparison(joinAlias.joinAlias + column.name, operator, arrayValue['@value'])
                
                if (arrayValue['@not'] === true) {
                  l.lib('Adding comparison with NOT', comp)
                  subCondition.push('NOT', comp)
                }
                else {
                  l.lib('Adding comparison', comp)
                  subCondition.push(comp)
                }
              }

              l.lib('Setting logical operator back to the default OR')
              logical = 'OR'
            }

            l.lib('Created brackets', subCondition)
          }
        }
        else {
          let comp = comparison(joinAlias.joinAlias + column.name, value)
          l.lib('Adding comparison with default operator =', comp)
          sqlCondition.push(comp)
        }
      }

      l.location = undefined

      if (table.relationships.length > 0) {
        l.lib('Iterating over all relationships...')

        for (let relationship of table.relationships) {
          l.location = [ relationship.name ]

          if (! (relationship.name in criteria)) {
            l.lib('Skipping relationship because it is not contained in the given criteria')
            continue
          }

          let relationshipCriteria = criteria[relationship.name]
          let otherTable = relationship.otherTable

          l.lib('Processing given criterium', relationshipCriteria)

          if (relationshipCriteria['@loadSeparately'] !== true) {
            let thisId = relationship.thisId
            let otherId = relationship.otherId

            let relationshipJoinAlias = joinAlias.join(relationship)

            query.join('LEFT', otherTable.name, relationshipJoinAlias.alias, joinAlias.joinAlias + thisId.name + ' = ' + relationshipJoinAlias.joinAlias + otherId.name)
            l.lib('Added LEFT JOIN to query', query._join!.pieces![query._join!.pieces!.length - 1])

            l.calling('Filling query with the relationship criteria', relationshipCriteria)
            this.addCriteria(otherTable, query, relationshipCriteria, asDatabaseCriteria, relationshipJoinAlias, sqlCondition)
            l.called('Filled query with the relationship criteria', relationshipCriteria)
          }
          else {
            l.lib('Not adding because it is to load in a separate query')
          }
        }
      }
    }
    else {
      l.warn('Given criteria type is not supported. It needs to be either an object or an array.', typeof criteria)
    }
  }  
  
  selectAllColumnsExplicitly(query: Query) {
    if (query._from && query._from.pieces) {
      for (let from of query._from.pieces) {
        if (from instanceof From) {
          let fromTable = this.schema.getTable(from.table)
      
          for (let column of fromTable.columns) {
            let alias = from.alias != undefined && from.alias.length > 0 ? from.alias : undefined
            query.select((alias != undefined ? alias + '.' : '') + column.name + ' ' + (alias != undefined ? '"' + alias + '__' + column.name + '"' : ''))
          }
        }
      }
    }
  
    if (query._join && query._join.pieces) {
      for (let join of query._join.pieces) {
        if (join instanceof Join) {
          let joinTable = this.schema.getTable(join.table)
    
          for (let column of joinTable.columns) {
            let alias = join.alias != undefined && join.alias.length > 0 ? join.alias : undefined
            query.select((alias != undefined ? alias + '.' : '') + column.name + ' ' + (alias != undefined ? '"' + alias + '__' + column.name + '"' : ''))
          }  
        }
      }
    }
  }

  /**
   * Builds an SQL SELECT query which will select every column also of
   * every given relationship that is to be loaded. The result is a 
   * knight-sql query object.
   * 
   * This query object is ready to be transformed into SQL along with the
   * values that were specified in the criteria.
   * 
   * @param table The table the criteria was specified for
   * @param criteria The criteria
   * @param asDatabaseCriteria If set to true, the given criteria can directly reference database columns instead of instance properties
   * @returns A knight-sql query object
   */
  buildCriteriaReadQuery(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    criteria: Criteria, 
    asDatabaseCriteria = false
  ): Query {

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    let query = new Query
    query.from(table.name, table.name)
    this.addCriteria(table, query, criteria, asDatabaseCriteria)
    this.selectAllColumnsExplicitly(query)
    return query
  }

  /**
   * Builds an SQL SELECT query which will select the COUNT(*) in the 
   * form of a knight-sql query object which contains all the given criteria.
   * 
   * This query object is ready to be transformed into SQL along with the
   * values that were specified in the criteria.
   * 
   * @param table The table the criteria was specified for
   * @param criteria The criteria
   * @param asDatabaseCriteria If set to true, the given criteria can directly reference database columns instead of instance properties
   * @returns A knight-sql query object
   */
  buildCriteriaCountQuery(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    criteria: Criteria, 
    asDatabaseCriteria = false
  ): Query {

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    let query = new Query
    query.from(table.name, table.name).select('COUNT(*) as count')
    this.addCriteria(table, query, criteria, asDatabaseCriteria)
    return query
  }  
}
