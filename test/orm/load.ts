import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Orm } from '../../src'
import { schema } from '../testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

export function loadTests(db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any>) {
  let orm = new Orm(schema, db)
  let table1 = schema.getTable('table1')
  let table2 = schema.getTable('table2')

  describe('load', function() {
    it('should load all rows', async function() {
      let date1 = new Date
      let date2 = new Date
      let date3 = new Date
      await orm.store(queryFn, table1, { property1: 'a', property2: 1, property3: date1 })
      await orm.store(queryFn, table1, { property1: 'b', property2: 2, property3: date2 })
      await orm.store(queryFn, table1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await orm.load(queryFn, table1, {})

      expect(rows.length).to.equal(3)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        property3: date1,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(rows[1]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: 2,
        property3: date2,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(rows[2]).to.deep.equal({
        id: 3,
        property1: 'c',
        property2: 3,
        property3: date3,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should order by a column', async function() {
      let date1 = new Date
      let date2 = new Date
      let date3 = new Date
      await orm.store(queryFn, table1, { property1: 'a', property2: 1, property3: date1 })
      await orm.store(queryFn, table1, { property1: 'b', property2: 2, property3: date2 })
      await orm.store(queryFn, table1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await orm.load(queryFn, table1, {
        '@orderBy': {
          field: 'property2',
          direction: 'DESC'
        }
      }, true)

      expect(rows.length).to.equal(3)
      
      expect(rows[0]).to.deep.equal({
        id: 3,
        property1: 'c',
        property2: 3,
        property3: date3,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(rows[1]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: 2,
        property3: date2,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(rows[2]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        property3: date1,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should limit the results', async function() {
      let date1 = new Date
      let date2 = new Date
      let date3 = new Date
      await orm.store(queryFn, table1, { property1: 'a', property2: 1, property3: date1 })
      await orm.store(queryFn, table1, { property1: 'b', property2: 2, property3: date2 })
      await orm.store(queryFn, table1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await orm.load(queryFn, table1, {
        '@limit': 2
      }, true)

      expect(rows.length).to.equal(2)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        property3: date1,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(rows[1]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: 2,
        property3: date2,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should offset the results', async function() {
      let date1 = new Date
      let date2 = new Date
      let date3 = new Date
      await orm.store(queryFn, table1, { property1: 'a', property2: 1, property3: date1 })
      await orm.store(queryFn, table1, { property1: 'b', property2: 2, property3: date2 })
      await orm.store(queryFn, table1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await orm.load(queryFn, table1, {
        '@offset': 2
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 3,
        property1: 'c',
        property2: 3,
        property3: date3,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should regard criteria in a many-to-one relationship', async function() {
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 1 }})
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 2 }})
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 3 }})

      let rows = await orm.load(queryFn, table1, {
        property1: 'a',
        manyToOneObject1: {
          property2: 1
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should regard criteria in a many-to-one relationship regarding the id', async function() {
      await orm.store(queryFn, table1, { manyToOneObject1: { }})
      await orm.store(queryFn, table1, { manyToOneObject1: { }})
      await orm.store(queryFn, table1, { manyToOneObject1: { }})

      let rows = await orm.load(queryFn, table1, {
        manyToOneObject1: {
          id: 1
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: null,
        property2: null,
        property3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should regard criteria in a many-to-one relationship and load it', async function() {
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 1 }})
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 2 }})
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 3 }})

      let rows = await orm.load(queryFn, table1, {
        property1: 'a',
        manyToOneObject1: {
          '@load': true,
          property2: 1
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 1,
          property1: null,
          property2: 1,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }
      })
    })

    it('should load a many-to-one relationship separately', async function() {
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 1 }})
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 2 }})
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 3 }})

      let rows = await orm.load(queryFn, table1, {
        property1: 'a',
        manyToOneObject1: {
          '@loadSeparately': true,
          property2: 1
        }
      }, true)

      expect(rows.length).to.equal(3)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 1,
          property1: null,
          property2: 1,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        }
      })

      expect(rows[1]).to.deep.equal({
        id: 4,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 3,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: null
      })

      expect(rows[2]).to.deep.equal({
        id: 6,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 5,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: null
      })
    })

    it('should regard criteria in a one-to-many relationship', async function() {
      await orm.store(queryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await orm.store(queryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await orm.store(queryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await orm.load(queryFn, table1, {
        property1: 'a',
        oneToManyObject1: {
          property1: 'd'
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('should regard criteria in a one-to-many relationship and load it', async function() {
      await orm.store(queryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await orm.store(queryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await orm.store(queryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await orm.load(queryFn, table1, {
        property1: 'a',
        oneToManyObject1: {
          '@load': true,
          property1: 'd'
        }
      }, true)

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject1: [
          {
            id: 2,
            property1: 'd',
            property2: null,
            property3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: 1
          }
        ]
      })
    })

    it('should load a one-to-many relationship separately', async function() {
      await orm.store(queryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await orm.store(queryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await orm.store(queryFn, table1, { property1: 'a', oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await orm.load(queryFn, table1, {
        property1: 'a',
        oneToManyObject1: {
          '@loadSeparately': true,
          property1: 'd'
        }
      }, true)

      expect(rows.length).to.equal(3)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject1: [
          {
            id: 2,
            property1: 'd',
            property2: null,
            property3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: 1
          }
        ]
      })

      expect(rows[1]).to.deep.equal({
        id: 4,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject1: []
      })

      expect(rows[2]).to.deep.equal({
        id: 7,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        oneToManyObject1: []
      })
    })

    it('should process criteria given as array', async function() {
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 1 }, oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 2 }, oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await orm.store(queryFn, table1, { property1: 'a', manyToOneObject1: { property2: 3 }, oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await orm.load(queryFn, table1, [
        {
          property1: 'a',
          manyToOneObject1: {
            '@load': true,
            property2: 1
          }
        },
        'OR',
        {
          property1: 'a',
          oneToManyObject1: {
            '@loadSeparately': true,
            property1: 'd'
          }
        }
      ], true)

      expect(rows.length).to.equal(3)
      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 1,
          property1: null,
          property2: 1,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        },
        oneToManyObject1: [
          {
            id: 3,
            property1: 'd',
            property2: null,
            property3: null,
            many_to_one_object1_id: null,
            many_to_one_object2_id: null,
            one_to_one_object1_id: null,
            one_to_one_object2_id: null,
            one_to_many_object1_many_to_one_id: 2
          }
        ]
      })

      expect(rows[1]).to.deep.equal({
        id: 6,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 5,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 5,
          property1: null,
          property2: 2,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        },
        oneToManyObject1: []
      })

      expect(rows[2]).to.deep.equal({
        id: 10,
        property1: 'a',
        property2: null,
        property3: null,
        many_to_one_object1_id: 9,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
        manyToOneObject1: {
          id: 9,
          property1: null,
          property2: 3,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
        },
        oneToManyObject1: []
      })
    })

    it('should not select rows which columns are null', async function() {
      await queryFn('INSERT INTO table2 DEFAULT VALUES')
      await queryFn('INSERT INTO table2 DEFAULT VALUES')
      await queryFn('INSERT INTO table2 DEFAULT VALUES')

      let rows = await orm.load(queryFn, table2, {}, true)

      expect(rows.length).to.equal(0)
    })
  })

  describe('criteriaDelete', function() {
    it('should delete a simple obj1 by id', async function() {
      await orm.store(queryFn, table1, { property1: 'a', property2: 1 })
      await orm.store(queryFn, table1, { property1: 'b', property2: 2 })

      let deletedRows = await orm.criteriaDelete(queryFn, table1, { id: 1 }, true)

      expect(deletedRows).to.deep.equal([{
        id: 1,
        property1: 'a',
        property2: 1,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      }])

      let table1Result = await queryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result).to.deep.equal([{
        id: 2,
        property1: 'b',
        property2: 2,
        property3: null,
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

      let deletedRows = await orm.criteriaDelete(queryFn, table1, { property1: 'a' }, true)

      expect(deletedRows).to.deep.equal([{
        id: 1,
        property1: 'a',
        property2: 1,
        property3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      }])

      let table1Result = await queryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(1)
      expect(table1Result).to.deep.equal([{
        id: 2,
        property1: 'b',
        property2: 2,
        property3: null,
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

      let table1Result = await queryFn('SELECT * FROM table1')

      expect(table1Result.rows.length).to.equal(2)
      expect(table1Result).to.deep.equal([
        {
          id: 1,
          property1: 'a',
          property2: 1,
          property3: null,
          many_to_one_object1_id: null,
          many_to_one_object2_id: null,
          one_to_one_object1_id: null,
          one_to_one_object2_id: null,
          one_to_many_object1_many_to_one_id: null
          },
        {
          id: 2,
          property1: 'b',
          property2: 2,
          property3: null,
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
