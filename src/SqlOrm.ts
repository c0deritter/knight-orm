import sql, { Query } from 'mega-nice-sql'
import { fillCreateCriteria } from 'mega-nice-sql-criteria-filler'
import { Relationship, Schema, Table } from './Schema'

export class SqlOrm {

  schema: Schema
  db: string
  query: (queryString: string, values: any[]) => any[]
  
  constructor(schema: Schema, db: string, query: (sqlString: string, values: any[]) => any[]) {
    this.schema = schema
    this.db = db
    this.query = query
  }

  add(...tables: Table[]) {
    for (let table of tables) {
      this.schema[table.name] = table
    }
  }

}