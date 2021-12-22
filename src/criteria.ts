import { Criteria, CriteriaObject, isCriteriaComparison, Operator, OrderBy } from 'knight-criteria'
import { Log } from 'knight-log'
import { comparison, Condition, Query } from 'knight-sql'
import { Orm, Schema } from '.'
import { JoinAlias } from './join'
import { Relationship, Table } from './schema'

let log = new Log('knight-orm/criteria.ts')

/**
 * Describes the properties of one criteria issue. Criteria can have
 * issues if for example the referenced object properties or database columns
 * do not exist.
 */
 export interface CriteriaIssue {
  location: string
  message: string
}

/**
 * The result of 'determineRelationshipsToLoadSeparately'. It contains the
 * relationship itself, the criteria with which the relationship objects are
 * to be loaded and a list of objects for which the relationships are
 * to be loaded.
 * 
 * With this information it is possible to load every relationship object
 * for every given relationship owning object with only one database query.
 */
  export interface RelationshipToLoad {
  relationship: Relationship
  relationshipCriteria: CriteriaObject
  objs: any[]
}

/**
 * It contains a mapping from a relationship path to an object
 * following the interface 'RelationshipToLoad'.
 * 
 * The path itself is not a mandatory information which would be
 * needed to load the relationships. Its purpose is to inform
 * the programmer about the exact place of the relationship.
 */
export interface RelationshipsToLoad {
  [ relationshipPath: string ]: RelationshipToLoad
}

export class CriteriaTools {
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

  /**
   * Can be used to check given criteria for their correctness.
   * 
   * The function will warn if a a property did not reference a valid object property
   * (or database column if the parameter 'asDatabaseCriteria' is true), a valid relationship
   * nor a valid @-property like '@load' or '@orderBy'.
   * 
   * @param table The table the criteria was created for
   * @param criteria The criteria
   * @param asDatabaseCriteria Set to true if the criteria reference database columns instead of instance properties
   * @param path An internal parameter which is used for creating the location in the resulting CriteriaIssue object
   * @returns A list of CriteriaIssue objects
   */
  validateCriteria(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    criteria: Criteria, 
    asDatabaseCriteria = false, 
    path: string = ''
  ): CriteriaIssue[] {

    let issues: CriteriaIssue[] = []

    if (criteria == undefined) {
      return issues
    }

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    if (criteria instanceof Array) {
      for (let criterium of criteria) {
        if (typeof criterium == 'object') {
          let criteriumIssues = this.validateCriteria(table, criterium, asDatabaseCriteria)
          issues.push(...criteriumIssues)
        }
      }
    }

    else if (typeof criteria == 'object' && criteria !== null) {
      for (let key of Object.keys(criteria)) {
        if (! asDatabaseCriteria && table.propertyNames.indexOf(key) > -1) {
          continue
        }

        if (asDatabaseCriteria && table.columnNames.indexOf(key) > -1) {
          continue
        }

        if (table.relationshipNames.indexOf(key) > -1) {
          continue
        }

        if (key == '@not' || key == '@load' || key == '@loadSeparately' || key == '@count' ||
            key == '@min' || key == '@max' || key == '@orderBy' || key == '@limit' || key == '@offset') {
          continue
        }

        issues.push({
          location: path + key,
          message: asDatabaseCriteria ?
            'Given column, relationship or @-property does not exist' : 
            'Given property, relationship or @-property does not exist'
        })
      }

      for (let relationship of table.relationships) {
        if (criteria[relationship.name] != undefined) {
          let relationshipIssues = this.validateCriteria(relationship.otherTable, criteria[relationship.name], asDatabaseCriteria, path + relationship.name + '.')
          issues.push(...relationshipIssues)
        }
      }
    }

    return issues
  }

  /**
   * Converts criteria which use properties from the object world into criteria which use columns
   * from the database world.
   * 
   * @param schema The schema which maps database columns to object properties
   * @param tableName The name of the table the given instance criteria refer to
   * @param instanceCriteria The criteria referring properties from the object world
   * @returns Criteria referring columns of the database world
   */
  instanceCriteriaToRowCriteria(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    instanceCriteria: Criteria
  ): Criteria {

    let l = log.fn('instanceCriteriaToRowCriteria')
    l.param('instanceCriteria', instanceCriteria)
    
    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    if (instanceCriteria instanceof Array) {
      l.lib('Given instance criteria are of type array')
      let rowCriteria = []
      
      for (let instanceCriterium of instanceCriteria) {
        if (typeof instanceCriterium == 'object' && instanceCriterium !== null) {
          l.calling('Converting criteria object to refer database columns')
          let rowCriterium = this.instanceCriteriaToRowCriteria(table, instanceCriterium)
          l.called('Converted criteria object to refer database columns')
          l.lib('Adding converted criteria')
          rowCriteria.push(rowCriterium)
        }
        else if (instanceCriterium == 'AND' || instanceCriterium == 'OR' || instanceCriterium == 'XOR') {
          l.lib('Adding logical operator', instanceCriterium)
          rowCriteria.push(instanceCriterium)
        }
        else {
          l.lib('Found invalid element in criteria array. Not adding.', instanceCriterium)
        }
      }

      return rowCriteria
    }

    else if (typeof instanceCriteria == 'object' && instanceCriteria !== null) {
      l.lib('Given instance criteria are of type object')
      let rowCriteria: CriteriaObject = {}

      for (let column of table.columns) {
        l.dev('Trying to add property as column', column.propertyName, column.name)

        if (column.propertyName in instanceCriteria) {
          l.dev('Property contained. Adding.', instanceCriteria[column.propertyName])
          rowCriteria[column.name] = instanceCriteria[column.propertyName]
        }
        else {
          l.dev('Property not contained. Not adding.')
        }
      }

      l.lib('Converted instance properties to database columns and set them on the result', rowCriteria)
    
      if (table.relationships.length > 0) {
        l.lib('Convert relationships...')
        l.location = []

        for (let relationship of table.relationships) {
          l.location[0] = relationship.name
          l.lib('Converting next relationship', relationship.name)

          if (typeof instanceCriteria[relationship.name] == 'object' && instanceCriteria[relationship.name] !== null) {
            l.calling('Converting relationship criteria to refer database columns')
            let relationshipRowCriteria = this.instanceCriteriaToRowCriteria(relationship.otherTable, instanceCriteria[relationship.name])
            l.calling('Converted relationship criteria to refer database columns')
            rowCriteria[relationship.name] = relationshipRowCriteria
          }
          else {
            l.lib('Invalid relationship criteria found. Not adding.', instanceCriteria[relationship.name])
          }
        }

        l.location = undefined
      }
    
      for (let propertyName of Object.keys(instanceCriteria)) {
        if (propertyName == '@not' || propertyName == '@load' || propertyName == '@loadSeparately' ||
            propertyName == '@count' || propertyName == '@min' || propertyName == '@max' ||
            propertyName == '@limit' || propertyName == '@offset') {

          l.lib('Adding @-property', propertyName)
          ;(rowCriteria as any)[propertyName] = instanceCriteria[propertyName]
        }
        else if (propertyName == '@orderBy') {
          let orderBy = instanceCriteria['@orderBy']

          if (typeof orderBy == 'string') {
            let column = table.getColumnByProperty(orderBy)

            if (column != undefined) {
              rowCriteria['@orderBy'] = column.name
            }
          }

          else if (orderBy instanceof Array) {
            rowCriteria['@orderBy'] = []

            for (let orderByElement of orderBy) {
              if (typeof orderByElement == 'string') {
                let column = table.getColumnByProperty(orderByElement)
      
                if (column != undefined) {
                  rowCriteria['@orderBy'].push(column.name)
                }
              }

              else if (typeof orderByElement == 'object' && orderByElement !== null && 'field' in orderByElement) {
                let column = table.getColumnByProperty(orderByElement.field)

                if (column != undefined) {
                  let orderByObject: OrderBy = {
                    field: column.name
                  }

                  rowCriteria['@orderBy'].push(orderByObject)

                  if ('direction' in orderByElement) {
                    orderByObject.direction = orderByElement.direction
                  }
                }
              }
            }
          }

          else if (typeof orderBy == 'object' && orderBy !== null && 'field' in orderBy) {
            let column = table.getColumnByProperty(orderBy.field)

            if (column != undefined) {
              let orderByObject: OrderBy = {
                field: column.name
              }

              rowCriteria['@orderBy'] = orderByObject

              if ('direction' in orderBy) {
                orderByObject.direction = orderBy.direction
              }
            }
          }
        }
      }
    
      l.returning('Returning converted criteria', rowCriteria)
      return rowCriteria
    }

    l.returning('Returning unconverted criteria because they were neither an array nor an object and this invalid', instanceCriteria)
    return instanceCriteria
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
    let l = log.fn('addCriteria')
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
            if (table.hasColumn(criteria['@orderBy'].field)) {
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
              l.lib('Not ORDER BY because the given column is not contained in the table', criteria['@orderBy'])
            }
          }
          else {
            l.lib('Not adding ORDER BY because the given field property is not a string', criteria['@orderBy'])
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

  /**
   * Determines the relationships that are to be loaded separately
   * according to the given criteria.
   * 
   * It also determines the specific instances or database rows for
   * which the relationships have to be loaded.
   * 
   * The result is a mapping from a relationship path to an object
   * containing all the information needed to load the relationship
   * objects. It follows the interface 'RelationshipsToLoad'.
   * 
   * @param table The table the criteria was created for
   * @param objs A list of objects for which the relationships are to be loaded
   * @param criteria The criteria which contains the information about which relationships are to be loaded separately
   * @param relationshipPath An internal parameter to keep track of the relationship path
   * @param relationshipsToLoad An internal parameter which is the result that will be returned at the end
   * @returns A mapping from a relationship path to an object containing every information to load the objects of an relationship. It follows the 'RelationshipsToLoad' interface.
   */
  determineRelationshipsToLoadSeparately(
    classNameOrTable: (new (...args: any[]) => any)|Table, 
    objs: any[], 
    criteria: Criteria, 
    relationshipPath: string = '', 
    relationshipsToLoad: RelationshipsToLoad = {}
  ): RelationshipsToLoad {

    let l = log.fn('determineRelationshipsToLoadSeparately')
    
    if (relationshipPath.length > 0) {
      l.location = [ relationshipPath ]
    }
    else {
      l.location = [ '.' ]
    }

    l.param('objs', objs)
    l.param('criteria', criteria)
    l.param('relationshipPath', relationshipPath)
    l.param('relationshipsToLoad', relationshipsToLoad)

    let table: Table
    if (typeof classNameOrTable == 'function') {
      table = this.schema.getTableByClassName(classNameOrTable)
    }
    else {
      table = classNameOrTable
    }

    if (table.relationships == undefined) {
      l.returning('There are not any relationships. Returning...')
      return {}
    }

    if (criteria instanceof Array) {
      l.lib('Criteria is an array')

      for (let criterium of criteria) {
        if (criterium instanceof Array || typeof criterium == 'object') {
          l.calling('Determining relationships to load of', criterium)
          this.determineRelationshipsToLoadSeparately(table, objs, criterium, relationshipPath, relationshipsToLoad)
          l.called('Determined relationships to load of', criterium)
        }
      }
    }
    else if (typeof criteria == 'object') {
      l.lib('Criteria is an object')
      l.lib('Iterating through all possible relationships', Object.keys(table.relationships))
      
      l.location.push('->')

      for (let relationship of table.relationships) {
        l.location[2] = relationship.name
    
        let relationshipCriteria = criteria[relationship.name]
        if (relationshipCriteria == undefined) {
          l.lib('There are no criteria. Processing next relationship...')
          continue
        }
    
        l.lib('Found criteria', relationshipCriteria)
    
        let subRelationshipPath = relationshipPath + '.' + relationship.name
        l.lib('Creating relationship path', subRelationshipPath)
    
        if (relationshipCriteria['@loadSeparately'] === true) {
          l.lib('Relationship should be loaded separately')
    
          if (relationshipsToLoad[subRelationshipPath] == undefined) {
            relationshipsToLoad[subRelationshipPath] = {
              relationship: relationship,
              relationshipCriteria: relationshipCriteria,
              objs: objs
            }
          }
        }
        else if (relationshipCriteria['@load'] === true) {
          let relationshipObjs = []
          
          for (let obj of objs) {
            if (relationship.manyToOne && obj[relationship.name] != undefined || 
                relationship.oneToMany && obj[relationship.name] instanceof Array && obj[relationship.name].length > 0) {
              
              if (relationship.manyToOne) {
                relationshipObjs.push(obj[relationship.name])
              }
              else {
                relationshipObjs.push(...obj[relationship.name])
              }
            }
          }
    
          l.calling('Relationship was already loaded through a JOIN. Determining relationships of the relationship. Going into recursion...')
    
          this.determineRelationshipsToLoadSeparately(
            relationship.otherTable, 
            relationshipObjs, 
            relationshipCriteria, 
            subRelationshipPath,
            relationshipsToLoad
          )
    
          l.called('Returning from recursion...')
        }
        else {
          l.lib('Relationship should not be loaded')
        }
      }  
    }
    else {
      l.lib('Criteria has an invalid type. Needs to be either an array or an object.', typeof criteria)
    }

    if (relationshipPath.length > 0) {
      l.location = [ relationshipPath ]
    }
    else {
      l.location = undefined
    }

    l.returning('Returning relationships to load...', relationshipsToLoad)
    return relationshipsToLoad
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
    this.orm.queryTools.selectAllColumnsExplicitly(query)
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
