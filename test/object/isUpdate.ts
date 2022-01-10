import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Orm } from '../../src'
import { schema } from '../testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

export function isUpdateTests(db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any>) {
  let orm = new Orm(schema, db)

  describe('isUpdate', function() {
    it('should return false if the generated primary key is not set', async function() {
      let row = {
      }

      let result = await orm.objectTools.isUpdate(schema.getTable('table1'), queryFn, row, true)

      expect(result).to.be.false
    })

    it('should return true if the generated primary key is already set', async function() {
      let row = {
        id: 1
      }

      let result = await orm.objectTools.isUpdate(schema.getTable('table1'), queryFn, row, true)

      expect(result).to.be.true
    })

    it('should return false if a row with the not generated primary does not exist', async function() {
      let row = {
        id: 'x'
      }

      let result = await orm.objectTools.isUpdate(schema.getTable('table2'), queryFn, row, true)

      expect(result).to.be.false
    })

    it('should return true if a row with the not generated primary does already exist', async function() {
      await queryFn('INSERT INTO table2 (id) VALUES (\'x\')')

      let row = {
        id: 'x'
      }

      let result = await orm.objectTools.isUpdate(schema.getTable('table2'), queryFn, row, true)

      expect(result).to.be.true
    })

    it('should return false if a row with the composite primary key does not exist', async function() {
      let row = {
        table1_id: 1,
        table2_id: 'x'
      }

      let result = await orm.objectTools.isUpdate(schema.getTable('many_to_many_table2'), queryFn, row, true)

      expect(result).to.be.false
    })

    it('should return true if a row with the composite primary key does already exist', async function() {
      await queryFn('INSERT INTO many_to_many_table2 (table1_id, table2_id) VALUES (1, \'x\')')

      let row = {
        table1_id: 1,
        table2_id: 'x'
      }

      let result = await orm.objectTools.isUpdate(schema.getTable('many_to_many_table2'), queryFn, row, true)

      expect(result).to.be.true
    })
  })
}
