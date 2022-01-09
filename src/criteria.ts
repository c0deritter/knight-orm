import { Criteria, CriteriaObject, OrderBy } from 'knight-criteria'
import { Log } from 'knight-log'
import { Orm, Schema } from '.'
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

let criteriaToolsLog = log.cls('CriteriaTools')

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

    let l = criteriaToolsLog.mt('instanceCriteriaToRowCriteria')
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

    let l = criteriaToolsLog.mt('determineRelationshipsToLoadSeparately')
    
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
          l.lib('Determining relationships to load of', criterium)
          l.calling('Calling \'knight-orm/criteria.ts CriteriaTools.determineRelationshipsToLoadSeparately\'')
          this.determineRelationshipsToLoadSeparately(table, objs, criterium, relationshipPath, relationshipsToLoad)
          l.called('Calling \'knight-orm/criteria.ts CriteriaTools.determineRelationshipsToLoadSeparately\'')
          l.lib('Determined relationships to load of', criterium)
        }
      }
    }
    else if (typeof criteria == 'object') {
      l.lib('Criteria is an object')
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
        l.lib('Created relationship path', subRelationshipPath)
    
        if (relationshipCriteria['@loadSeparately'] === true) {
          l.lib('Relationship should be loaded separately. Adding to result.')
    
          if (relationshipsToLoad[subRelationshipPath] == undefined) {
            l.dev('Relationship path does not exist on result. Adding...')
            relationshipsToLoad[subRelationshipPath] = {
              relationship: relationship,
              relationshipCriteria: relationshipCriteria,
              objs: objs
            }
          }
          else {
            l.dev('Relationship path does exist on result. Not adding to the result.', relationshipsToLoad[subRelationshipPath])
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
}
