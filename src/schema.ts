import { Log } from 'knight-log'

let log = new Log('schema.ts')

export class Schema {
  tables: Table[] = []

  addTable(tableName: string, tableSchema: {
    columns: {
      [name: string]:
        string
        |
        {
          property: string
          primaryKey?: boolean
          generated?: boolean
        }
    }
  
    relationships?: {
      [relationship: string]: {
        oneToMany?: boolean
        manyToOne?: boolean
        thisId: any
        otherTable: string
        otherId: any
        otherRelationship?: string      
      }
    }
  
    newInstance: () => any
    rowToInstance?: (row: any, instance: any) => any
    instanceToRow?: (instance: any, row: any) => any
  }) {
    let table = new Table(
      this,
      tableName,
      tableSchema.newInstance,
      tableSchema.columns,
      tableSchema.relationships
    )

    this.tables.push(table)
  }

  getTable(tableName: string): Table {
    for (let table of this.tables) {
      if (table.name == tableName) {
        return table
      }
    }

    throw new Error(`Table '${tableName}' not contained in schema. Use method 'Schema.check' to find errors early.`)
  }

  getTableByClassName(className: string|(new () => any)): Table {
    if (typeof className == 'function') {
      className = className.name
    }

    for (let table of this.tables) {
      if (table.className == className) {
        return table
      }
    }

    throw new Error(`Class '${className}' does not map to any table in the schema. Use method 'Schema.check' to find errors early.`)
  }

  check() {
    for (let table of this.tables) {
      if (table.relationships) {
        table.className
        
        for (let relationship of table.relationships) {
          relationship.thisId
          relationship.otherTable
          relationship.otherId
          relationship.otherRelationship
        }
      }
    }
  }  
}

class AlreadyConverted {
  instancesAndRows: { instance: any, row: any }[] = []

  add(instance: any, row: any) {
    this.instancesAndRows.push({ instance: instance, row: row })
  }

  getRow(instance: any) {
    for (let instanceAndRow of this.instancesAndRows) {
      if (instanceAndRow.instance === instance) {
        return instanceAndRow.row
      }
    }
  }

  getInstance(row: any) {
    for (let instanceAndRow of this.instancesAndRows) {
      if (instanceAndRow.row === row) {
        return instanceAndRow.instance
      }
    }
  }
}

let tableLogger = log.cls('Table')

export class Table {
  schema: Schema
  name: string
  columns: Column[] = []
  relationships: Relationship[] = []

  private _className?: string
  private _primaryKey?: Column[]
  private _generatedPrimaryKey?: Column|null = null
  private _notGeneratedPrimaryKey?: Column[]
  private _columnNames?: string[]
  private _relationshipNames?: string[]

  newInstance: () => any
  customRowToInstance?: (row: any, instance: any) => any
  customInstanceToRow?: (instance: any, row: any) => any

  constructor(
    schema: Schema,
    tableName: string, 
    newInstance: () => any,
    columnSchema: {
      [name: string]:
        string
        |
        {
          property: string
          primaryKey?: boolean
          generated?: boolean
        }
    },
    relationshipSchema?: {
      [relationship: string]: {
        oneToMany?: boolean
        manyToOne?: boolean
        thisId: any
        otherTable: string
        otherId: any
        otherRelationship?: string      
      }
    }
  ) {
    this.schema = schema
    this.name = tableName
    this.newInstance = newInstance

    for (let columnName of Object.keys(columnSchema)) {
      let column = columnSchema[columnName]

      if (typeof column == 'string') {
        let columnObj = new Column(this, columnName, column)
        this.columns.push(columnObj)
      }
      else {
        let colunmObj = new Column(
          this,
          columnName, 
          column.property, 
          column.primaryKey ? true : false, 
          column.generated ? true : false
        )
        
        this.columns.push(colunmObj)
      }
    }

    if (relationshipSchema) {
      for (let relationshipName of Object.keys(relationshipSchema)) {
        let relationship = relationshipSchema[relationshipName]

        if (relationship.oneToMany !== true && relationship.manyToOne !== true) {
          throw new Error(`Relationship '${relationshipName}' of table '${tableName}' is defined to be both one-to-many and many-to-one. Only one type is possible. Use method 'Schema.check' to find errors early.`)
        }

        if (! relationship.oneToMany && ! relationship.manyToOne) {
          throw new Error(`Relationship '${relationshipName}' of table '${tableName}' is neither defined to be one-to-many nor many-to-one. You need to define to be one of the two. Use method 'Schema.check' to find errors early.`)
        }

        let relationshipObj = new Relationship(
          this,
          relationshipName,
          relationship.manyToOne ? true : false,
          relationship.thisId, 
          relationship.otherTable, 
          relationship.otherId,
          relationship.otherRelationship
        )

        this.relationships.push(relationshipObj)
      }
    }
  }

  get className(): string {
    if (! this._className) {
      let instance = this.newInstance()
      this._className = instance?.constructor?.name

      if (! this._className) {
        throw new Error(`Function 'newInstance' did not provide an object with a 'constructor.name' property to derive the class name from.`)
      }
    }

    return this._className
  }

  get primaryKey(): Column[] {
    if (! this._primaryKey) {
      this._primaryKey = []
  
      for (let column of this.columns) {
        if (column.primaryKey) {
          this._primaryKey.push(column)
        }
      }  
    }
  
    return this._primaryKey
  }

  get generatedPrimaryKey(): Column|undefined {
    if (this._generatedPrimaryKey === null) {
      this._generatedPrimaryKey = undefined

      for (let column of this.columns) {
        if (column.primaryKey && column.generated) {
          this._generatedPrimaryKey = column
          break
        }
      }
    }
    
    return this._generatedPrimaryKey
  }  

  get notGeneratedPrimaryKey(): Column[] {
    if (! this._notGeneratedPrimaryKey) {
      this._notGeneratedPrimaryKey = []

      for (let column of this.columns) {
        if (column.primaryKey && ! column.generated) {
          this._notGeneratedPrimaryKey.push(column)
        }
      }
    }
    
    return this._notGeneratedPrimaryKey
  }

  get columnNames(): string[] {
    if (! this._columnNames) {
      this._columnNames = []

      for (let column of this.columns) {
        this._columnNames.push(column.name)
      }
    }

    return this._columnNames
  }

  get relationshipNames(): string[] {
    if (! this._relationshipNames) {
      this._relationshipNames = []

      for (let relationship of this.relationships) {
        this._relationshipNames.push(relationship.name)
      }
    }

    return this._relationshipNames
  }

  hasColumn(columnName: string): boolean {
    for (let column of this.columns) {
      if (column.name == columnName) {
        return true
      }
    }

    return false
  }

  getColumn(columnName: string): Column {
    for (let column of this.columns) {
      if (column.name == columnName) {
        return column
      }
    }

    throw new Error(`Column '${columnName}' not contained in table '${this.name}'. Use method 'Schema.check' to find errors early.`)
  }

  getColumnByPropertyName(propertyName: string): Column|undefined {
    for (let column of this.columns) {
      if (column.propertyName == propertyName) {
        return column
      }
    }
  }

  getRelationship(relationshipName: string): Relationship {
    for (let relationship of this.relationships) {
      if (relationship.name == relationshipName) {
        return relationship
      }
    }

    throw new Error(`Relationship '${relationshipName}' not contained in table '${this.name}'. Use method 'Schema.check' to find errors early.`)
  }

  instanceToRow(instance: any, withoutRelationships = false, alreadyConverted: AlreadyConverted = new AlreadyConverted): any {
    let l = tableLogger.mt('instanceToRow')
    l.param('instance', instance)
    l.param('alreadyConverted', alreadyConverted.instancesAndRows)
  
    let row = alreadyConverted.getRow(instance)
    if (row != undefined) {
      l.lib('Row was already converted. Returning it...', row)
      return row
    }
  
    row = {}
    for (let column of this.columns) {
      if (column.propertyName in instance) {
        row[column.name] = instance[column.propertyName]
      }
    }
  
    l.lib('Created row through simple copying of the values from the instance', row)
  
    if (this.customInstanceToRow) {
      l.calling('Additionally applying custom instanceToRow function')
      row = this.customInstanceToRow(instance, row)
      l.called('Custom instanceToRow function applied', row)
    }

    if (withoutRelationships) {
      l.returning('Returning converted row without relationships...', row)
      return row
    }
  
    alreadyConverted.add(instance, row)
  
    if (this.relationships.length > 0) {
      l.lib('Iterating through relationships...')
      l.location = []
  
      for (let relationship of this.relationships) {
        l.location[0] = relationship.name
        l.lib('Processing next relationship', relationship.name)
    
        if (typeof instance[relationship.name] == 'object' && instance[relationship.name] !== null) {
          if (relationship.manyToOne) {
            l.calling('Relationship is many-to-one. Converting relationship instance by using recursion.')
            let relationshipRow = relationship.otherTable.instanceToRow(instance[relationship.name], withoutRelationships, alreadyConverted)
            l.called('Converted relationship instance', relationshipRow)
            row[relationship.name] = relationshipRow
          }
          else if (instance[relationship.name] instanceof Array) {
            l.lib('Relationship is one-to-many. Converting every relationship instance...')
    
            if (row[relationship.name] == undefined) {
              row[relationship.name] = []
            }
  
            for (let relationshipInstance of instance[relationship.name]) {
              l.calling('Converting next relationship instance by using recursion')
              let relationshipRow = relationship.otherTable.instanceToRow(relationshipInstance, withoutRelationships, alreadyConverted)
              l.called('Converted relationship instance')
        
              row[relationship.name].push(relationshipRow)
            }        
          }
          else {
            l.warn('Relationship is one-to-many but given relationship row object is not of type array', instance[relationship.name])
          }
        }
        else if (instance[relationship.name] !== undefined) {
          l.lib('Relationship is not an object and not undefined which is invalid. Assigning it to row as it is.')
          row[relationship.name] = instance[relationship.name]
        }
        else {
          l.lib('Relationship does not exist on this instance. Continuing...')
        }
      }
  
      l.location = undefined
    }
  
    l.returning('Returning row', row)
    return row
  }
  
  rowToInstance(row: any, alreadyConverted: AlreadyConverted = new AlreadyConverted): any {
    let l = tableLogger.mt('rowToInstance')
    l.param('row', row)
    l.param('alreadyConverted', alreadyConverted.instancesAndRows)
  
    let instance = alreadyConverted.getInstance(row)
    if (instance != undefined) {
      l.lib('Instance was already converted. Returning it...', instance)
      return instance
    }
  
    instance = this.newInstance()
  
    for (let column of this.columns) {
      if (column.name in row) {
        if (column.propertyName != undefined) {
          instance[column.propertyName] = row[column.name]
        }
      }
    }
  
    l.lib('Created instance through simple copying of the values from the row', instance)
  
    if (this.customRowToInstance) {
      l.calling('Additionally applying custom rowToInstance function')
      instance = this.customRowToInstance(row, instance)
      l.called('Custom rowToInstance function applied', instance)
    }
  
    alreadyConverted.add(instance, row)
  
    l.lib('Converting relationships...')
  
    if (this.relationships.length > 0) {
      l.lib('Iterating through relationships...')
      l.location = []
  
      for (let relationship of this.relationships) {
        l.location[0] = relationship.name
        l.lib('Processing next relationship', relationship.name)
  
        if (typeof row[relationship.name] == 'object' && row[relationship.name] !== null) {
          if (relationship.manyToOne) {
            l.calling('Relationship is many-to-one. Converting relationship row by using recursion.')
            let relationshipInstance = relationship.otherTable.rowToInstance(row[relationship.name], alreadyConverted)
            l.called('Converted relationship instance')
            l.lib('Setting converted relationship instance')
            instance[relationship.name] = relationshipInstance
          }
          else if (row[relationship.name] instanceof Array) {
            l.lib('Relationship is one-to-many. Converting every relationship instance...')
    
            if (instance[relationship.name] == undefined) {
              instance[relationship.name] = []
            }
  
            for (let relationshipRow of row[relationship.name]) {
              l.calling('Converting next relationship row by using recursion')
              let relationshipInstance = relationship.otherTable.rowToInstance(relationshipRow, alreadyConverted)
              l.called('Converted relationship instance')
              l.lib('Adding converted relationship instance')
              instance[relationship.name].push(relationshipInstance)
            }        
          }
        }
        else if (row[relationship.name] !== undefined) {
          l.lib('Relationship is not an object and not undefined which is invalid. Assigning it to instance as it is.')
          row[relationship.name] = instance[relationship.name]
        }
        else {
          l.lib('Relationship is not set. Continuing...')
        }
      }
  
      l.location = undefined
    }
  
    l.returning('Returning instance...' ,instance)
    return instance
  }
}

export class Column {
  schema: Schema
  table: Table
  name: string
  propertyName: string
  primaryKey: boolean
  generated: boolean

  constructor(table: Table, name: string, propertyName: string, primaryKey: boolean = false, generated: boolean = false) {
    this.schema = table.schema
    this.table = table
    this.name = name
    this.propertyName = propertyName
    this.primaryKey = primaryKey
    this.generated = generated
  }

  getName(asDatabaseColumn = true): string {
    return asDatabaseColumn ? this.name : this.propertyName
  }

  isForeignKey(): boolean {
    for (let relationship of this.table.relationships) {
      if (relationship.thisIdColumnName == this.name) {
        return true
      }
    }
  
    return false
  }

  /**
   * It returns the name of a relationship as defined in the schema, if the given column 
   * is part of a many-to-one relationship.
   * 
   * @param table The schema of a table in which the given column resides
   * @param columnName The column for which we want to find out if it is part of a many-to-one 
   * relationship
   * @returns The name of the relationship if the given column was part of any or undefined 
   * if the given column is not part of any relationship.
   */
  getCorrespondingManyToOne(): Relationship|undefined {
    for (let relationship of this.table.relationships) {
      if (relationship.manyToOne && relationship.thisIdColumnName == this.name) {
        return relationship
      }
    }
  }
}

export class Relationship {
  schema: Schema
  table: Table
  name: string
  manyToOne: boolean
  thisIdColumnName: any
  otherTableName: string
  otherIdColumnName: any
  otherRelationshipName?: string

  private _thisId?: Column
  private _otherTable?: Table
  private _otherId?: Column
  private _otherRelationship?: Relationship

  constructor(table: Table, name: string, manyToOne: boolean, thisId: any, otherTable: string, otherId: any, otherRelationship?: string) {
    this.schema = table.schema
    this.table = table
    this.name = name
    this.manyToOne = manyToOne
    this.thisIdColumnName = thisId
    this.otherTableName = otherTable
    this.otherIdColumnName = otherId
    this.otherRelationshipName = otherRelationship
  }

  get oneToMany(): boolean {
    return ! this.manyToOne
  }

  get thisId(): Column {
    if (! this._thisId) {
      for (let column of this.table.columns) {
        if (column.name == this.thisIdColumnName) {
          this._thisId = column
          break
        }
      }

      if (! this._thisId) {
        throw new Error(`Column '${this.thisIdColumnName}' referenced in '${this.table.name}.${this.name}.thisId' is not contained in table '${this.table.name}'. Use method 'Schema.check' to find errors early.`)
      }
    }

    return this._thisId
  }

  get otherTable(): Table {
    if (! this._otherTable) {
      this._otherTable = this.schema.getTable(this.otherTableName)

      if (! this._otherTable) {
        throw new Error(`Table '${this.otherTableName}' referenced in '${this.table.name}.${this.name}.otherTable' is not contained in schema. Use method 'Schema.check' to find errors early.`)
      }
    }
    
    return this._otherTable
  }

  get otherId(): Column {
    if (! this._otherId) {
      for (let column of this.otherTable.columns) {
        if (column.name == this.otherIdColumnName) {
          this._otherId = column
          break
        }
      }

      if (! this._otherId) {
        throw new Error(`Column '${this.otherIdColumnName}' referenced in '${this.table.name}.${this.name}.otherId' is not contained in table '${this.otherTable.name}'. Use method 'Schema.check' to find errors early.`)
      }
    }

    return this._otherId
  }

  get otherRelationship(): Relationship|undefined {
    if (! this.otherRelationshipName) {
      return
    }

    if (! this._otherRelationship) {
      for (let relationship of this.otherTable.relationships) {
        if (relationship.name == this.otherRelationshipName) {
          this._otherRelationship = relationship
          break
        }
      }

      if (! this._otherRelationship) {
        throw new Error(`Relationship '${this.otherRelationshipName}' referenced in '${this.table.name}.${this.name}.otherRelationship' is not contained in table '${this.otherTable.name}'. Use method 'Schema.check' to find errors early.`)
      }

      if (this._otherRelationship.otherRelationshipName != this.name) {
        throw new Error(`Relationship '${this.otherTable.name}.${this.otherRelationshipName}' referenced in '${this.table.name}.${this.name}.otherRelationship' does not reference this relationship '${this.name}'. Use method 'Schema.check' to find errors early.`)
      }
    }

    return this._otherRelationship
  }
}
