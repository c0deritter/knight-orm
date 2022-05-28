import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import { Change } from 'knight-change'
import 'mocha'
import { Orm, SelectResult } from '../../src'
import { Object1, schema } from '../testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

export function remainingTests(db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any>) {
  let orm = new Orm(schema, db)
  let table1 = schema.getTable('table1')

  describe('delete', function() {
    it('should delete an entity', async function() {
      await orm.store(queryFn, Object1, { property1: 'a' })
      await orm.store(queryFn, Object1, { property1: 'b' })

      let obj1 = { id: 2 }

      let change = await orm.delete(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2
      })

      expect(change).to.deep.equal(
        new Change('Object1', {
          id: 2,
          property1: 'b',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'delete')
      )

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })
    })

    it('should not delete anything if the primary key is missing', async function() {
      await orm.store(queryFn, Object1, { property1: 'a' })
      await orm.store(queryFn, Object1, { property1: 'b' })

      let obj1 = {}

      expect(orm.delete(queryFn, table1, obj1)).to.be.rejectedWith('Could not delete object because the primary key is not set.')

      expect(obj1).to.deep.equal({})

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(2)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'c',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })
    })
  })

  describe.skip('criteriaDelete', function() {
    it('should delete a simple obj1 by id', async function() {
      await orm.store(queryFn, table1, { property1: 'a', property2: 1 })
      await orm.store(queryFn, table1, { property1: 'b', property2: 2 })

      let deletedRows = await orm.criteriaDelete(queryFn, table1, { id: 1 })

      expect(deletedRows).to.deep.equal([{
        id: 1,
        column1: 'a',
        column2: 1,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      }])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result).to.deep.equal([{
        id: 2,
        column1: 'b',
        column2: 2,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      }])
    })

    it('should delete a simple obj1 by another column than the id', async function() {
      await orm.store(queryFn, table1, { property1: 'a', property2: 1 })
      await orm.store(queryFn, table1, { property1: 'b', property2: 2 })

      let deletedRows = await orm.criteriaDelete(queryFn, table1, { property1: 'a' })

      expect(deletedRows).to.deep.equal([{
        id: 1,
        column1: 'a',
        column2: 1,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      }])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result).to.deep.equal([{
        id: 2,
        column1: 'b',
        column2: 2,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      }])
    })

    it('should not delete anything if the criteria contained invalid columns', async function() {
      await orm.store(queryFn, table1, { property1: 'a', property2: 1 })
      await orm.store(queryFn, table1, { property1: 'b', property2: 2 })

      expect(orm.criteriaDelete(queryFn, table1, { invalid: 'invalid' }, true)).to.be.rejectedWith(Error)

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(2)
      expect(table1Result).to.deep.equal([
        {
          id: 1,
          column1: 'a',
          column2: 1,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
          },
        {
          id: 2,
          column1: 'b',
          column2: 2,
          column3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
          }
      ])
    })
  })
}
