import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Orm, Schema } from '../../src'
import { Object1, Object2, schema } from '../testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

export function loadTests(db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any>) {
  let orm = new Orm(schema, db)

  describe('load', function() {
    it('should load all rows', async function() {
      let date1 = new Date(2011, 1, 1, 1, 1, 1, 0)
      let date2 = new Date(2022, 2, 2, 2, 2, 2, 0)
      let date3 = new Date(2033, 3, 3, 3, 3, 3, 0)
      await orm.store(queryFn, Object1, { property1: 'a', property2: 1, property3: date1 })
      await orm.store(queryFn, Object1, { property1: 'b', property2: 2, property3: date2 })
      await orm.store(queryFn, Object1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await orm.load(queryFn, Object1, {})

      expect(rows.length).to.equal(3)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        property3: date1,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })

      expect(rows[1]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: 2,
        property3: date2,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })

      expect(rows[2]).to.deep.equal({
        id: 3,
        property1: 'c',
        property2: 3,
        property3: date3,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })
    })

    it('should order by a column', async function() {
      let date1 = new Date(2011, 1, 1, 1, 1, 1, 0)
      let date2 = new Date(2022, 2, 2, 2, 2, 2, 0)
      let date3 = new Date(2033, 3, 3, 3, 3, 3, 0)
      await orm.store(queryFn, Object1, { property1: 'a', property2: 1, property3: date1 })
      await orm.store(queryFn, Object1, { property1: 'b', property2: 2, property3: date2 })
      await orm.store(queryFn, Object1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await orm.load(queryFn, Object1, {
        '@orderBy': {
          field: 'property2',
          direction: 'DESC'
        }
      })

      expect(rows.length).to.equal(3)
      
      expect(rows[0]).to.deep.equal({
        id: 3,
        property1: 'c',
        property2: 3,
        property3: date3,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })

      expect(rows[1]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: 2,
        property3: date2,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })

      expect(rows[2]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        property3: date1,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })
    })

    it('should limit the results', async function() {
      let date1 = new Date(2011, 1, 1, 1, 1, 1, 0)
      let date2 = new Date(2022, 2, 2, 2, 2, 2, 0)
      let date3 = new Date(2033, 3, 3, 3, 3, 3, 0)
      await orm.store(queryFn, Object1, { property1: 'a', property2: 1, property3: date1 })
      await orm.store(queryFn, Object1, { property1: 'b', property2: 2, property3: date2 })
      await orm.store(queryFn, Object1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await orm.load(queryFn, Object1, {
        '@limit': 2
      })

      expect(rows.length).to.equal(2)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: 1,
        property3: date1,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })

      expect(rows[1]).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: 2,
        property3: date2,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })
    })

    it('should offset the results', async function() {
      let date1 = new Date(2011, 1, 1, 1, 1, 1, 0)
      let date2 = new Date(2022, 2, 2, 2, 2, 2, 0)
      let date3 = new Date(2033, 3, 3, 3, 3, 3, 0)
      await orm.store(queryFn, Object1, { property1: 'a', property2: 1, property3: date1 })
      await orm.store(queryFn, Object1, { property1: 'b', property2: 2, property3: date2 })
      await orm.store(queryFn, Object1, { property1: 'c', property2: 3, property3: date3 })

      let rows = await orm.load(queryFn, Object1, {
        '@offset': 2
      })

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 3,
        property1: 'c',
        property2: 3,
        property3: date3,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })
    })

    it('should regard criteria in a many-to-one relationship', async function() {
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 1 }})
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 2 }})
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 3 }})
      
      let rows = await orm.load(queryFn, Object1, {
        property1: 'b',
        manyToOneObject1: {
          property2: 2
        }
      })

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: 1,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })
    })

    it('should regard criteria in a many-to-one relationship regarding the id', async function() {
      await orm.store(queryFn, Object1, { manyToOneObject1: { }})
      await orm.store(queryFn, Object1, { manyToOneObject1: { }})
      await orm.store(queryFn, Object1, { manyToOneObject1: { }})

      let rows = await orm.load(queryFn, Object1, {
        manyToOneObject1: {
          id: 1
        }
      })

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: null,
        property2: null,
        property3: null,
        manyToOneObject1Id: 1,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })
    })

    it('should regard criteria in a many-to-one relationship and load it', async function() {
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 1 }})
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 2 }})
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 3 }})

      let rows = await orm.load(queryFn, Object1, {
        property1: 'b',
        manyToOneObject1: {
          '@load': true,
          property2: 2
        }
      })

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: 1,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToOneObject1: {
          id: 1,
          property1: null,
          property2: 1,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }
      })
    })

    it('should load a many-to-one relationship separately', async function() {
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 1 }})
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 2 }})
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 3 }})

      let rows = await orm.load(queryFn, Object1, {
        property1: 'b',
        manyToOneObject1: {
          '@loadSeparately': true,
          property2: 2
        }
      })

      expect(rows.length).to.equal(3)

      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: 1,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToOneObject1: {
          id: 1,
          property1: null,
          property2: 1,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }
      })

      expect(rows[1]).to.deep.equal({
        id: 4,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: 3,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToOneObject1: null
      })

      expect(rows[2]).to.deep.equal({
        id: 6,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: 5,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToOneObject1: null
      })
    })

    it('should regard criteria in a one-to-many relationship', async function() {
      await orm.store(queryFn, Object1, { property1: 'a', oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await orm.store(queryFn, Object1, { property1: 'a', oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await orm.store(queryFn, Object1, { property1: 'a', oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await orm.load(queryFn, Object1, {
        property1: 'b',
        oneToManyObject1: {
          property1: 'e'
        }
      })

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })
    })

    it('should regard criteria in a one-to-many relationship and load it', async function() {
      await orm.store(queryFn, Object1, { property1: 'a', oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await orm.store(queryFn, Object1, { property1: 'a', oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await orm.store(queryFn, Object1, { property1: 'a', oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await orm.load(queryFn, Object1, {
        property1: 'b',
        oneToManyObject1: {
          '@load': true,
          property1: 'e'
        }
      })

      expect(rows.length).to.equal(1)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        oneToManyObject1: [
          {
            id: 2,
            property1: 'd',
            property2: null,
            property3: null,
            manyToOneObject1Id: null,
            manyToOneObject2Id: null,
            oneToOneObject1Id: null,
            oneToOneObject2Id: null,
            oneToManyObject1ManyToOneId: 1
          }
        ]
      })
    })

    it('should load a one-to-many relationship separately', async function() {
      await orm.store(queryFn, Object1, { property1: 'a', oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await orm.store(queryFn, Object1, { property1: 'a', oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await orm.store(queryFn, Object1, { property1: 'a', oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await orm.load(queryFn, Object1, {
        property1: 'b',
        oneToManyObject1: {
          '@loadSeparately': true,
          property1: 'e'
        }
      })

      expect(rows.length).to.equal(3)

      expect(rows[0]).to.deep.equal({
        id: 1,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        oneToManyObject1: [
          {
            id: 2,
            property1: 'd',
            property2: null,
            property3: null,
            manyToOneObject1Id: null,
            manyToOneObject2Id: null,
            oneToOneObject1Id: null,
            oneToOneObject2Id: null,
            oneToManyObject1ManyToOneId: 1
          }
        ]
      })

      expect(rows[1]).to.deep.equal({
        id: 4,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        oneToManyObject1: []
      })

      expect(rows[2]).to.deep.equal({
        id: 7,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        oneToManyObject1: []
      })
    })

    it('should process criteria given as array', async function() {
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 1 }, oneToManyObject1: [ { property1: 'd' }, { property1: 'e' } ]})
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 2 }, oneToManyObject1: [ { property1: 'f' }, { property1: 'g' } ]})
      await orm.store(queryFn, Object1, { property1: 'a', manyToOneObject1: { property2: 3 }, oneToManyObject1: [ { property1: 'h' }, { property1: 'i' } ]})

      let rows = await orm.load(queryFn, Object1, [
        {
          property1: 'b',
          manyToOneObject1: {
            '@load': true,
            property2: 2
          }
        },
        'OR',
        {
          property1: 'b',
          oneToManyObject1: {
            '@loadSeparately': true,
            property1: 'e'
          }
        }
      ])

      expect(rows.length).to.equal(3)
      expect(rows[0]).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: 1,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToOneObject1: {
          id: 1,
          property1: null,
          property2: 1,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        },
        oneToManyObject1: [
          {
            id: 3,
            property1: 'd',
            property2: null,
            property3: null,
            manyToOneObject1Id: null,
            manyToOneObject2Id: null,
            oneToOneObject1Id: null,
            oneToOneObject2Id: null,
            oneToManyObject1ManyToOneId: 2
          }
        ]
      })

      expect(rows[1]).to.deep.equal({
        id: 6,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: 5,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToOneObject1: {
          id: 5,
          property1: null,
          property2: 2,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        },
        oneToManyObject1: []
      })

      expect(rows[2]).to.deep.equal({
        id: 10,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: 9,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToOneObject1: {
          id: 9,
          property1: null,
          property2: 3,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        },
        oneToManyObject1: []
      })
    })

    it('should not load rows which columns are null', async function() {
      if (db == 'postgres') {
        await queryFn('INSERT INTO table2 DEFAULT VALUES')
        await queryFn('INSERT INTO table2 DEFAULT VALUES')
        await queryFn('INSERT INTO table2 DEFAULT VALUES')  
      }
      else {
        await queryFn('INSERT INTO table2 VALUES ()')
        await queryFn('INSERT INTO table2 VALUES ()')
        await queryFn('INSERT INTO table2 VALUES ()')
      }

      let rows = await orm.load(queryFn, Object2, {})

      expect(rows.length).to.equal(0)
    })

    // PostgreSQL has a 63 character limit for table names and aliases
    // MySQL has a 64 character limit for table names and aliases
    // This test checks if it is successful to load a row from tables with very long names
    it('should load data from tables with a very long name', async function() {
      await queryFn('DROP TABLE IF EXISTS very_long_table_name_with_63_characters_of_length_0123456789abc')
      await queryFn('CREATE TABLE very_long_table_name_with_63_characters_of_length_0123456789abc (column1 INTEGER)')
      await queryFn('INSERT INTO very_long_table_name_with_63_characters_of_length_0123456789abc (column1) VALUES (1)')

      let schema = new Schema
      schema.addTable('very_long_table_name_with_63_characters_of_length_0123456789abc', {
        columns: {
          'column1': 'property1'
        },
        newInstance: () => new VeryLongTableNameTestClass
      })

      let orm = new Orm(schema, db)

      let entities = await orm.load(queryFn, VeryLongTableNameTestClass, {
        property1: 1
      })

      expect(entities.length).to.equal(1)
      expect(entities[0]).to.deep.equal({
        property1: 1
      })

      await queryFn('DROP TABLE very_long_table_name_with_63_characters_of_length_0123456789abc')
    })

    // PostgreSQL has a 63 character limit for table names and aliases
    // MySQL has a 64 character limit for table names and aliases
    // This test checks if it is successful to load a row from tables with very long names
    it('should load data from tables with a long name and its relationships', async function() {
      await queryFn('DROP TABLE IF EXISTS very_long_table_name_with_63_characters_of_length_0123456789abc')
      await queryFn('DROP TABLE IF EXISTS very_long_table_name_with_63_characters_of_length_defghijklmnop')
      await queryFn('CREATE TABLE very_long_table_name_with_63_characters_of_length_0123456789abc (column1 INTEGER)')
      await queryFn('CREATE TABLE very_long_table_name_with_63_characters_of_length_defghijklmnop (column1 INTEGER)')
      await queryFn('INSERT INTO very_long_table_name_with_63_characters_of_length_0123456789abc (column1) VALUES (1)')
      await queryFn('INSERT INTO very_long_table_name_with_63_characters_of_length_defghijklmnop (column1) VALUES (1)')

      let schema = new Schema
      schema.addTable('very_long_table_name_with_63_characters_of_length_0123456789abc', {
        columns: {
          'column1': 'property1'
        },
        relationships: {
          'relationship1': {
            manyToOne: true,
            thisId: 'column1',
            otherTable: 'very_long_table_name_with_63_characters_of_length_defghijklmnop',
            otherId: 'column1'
          }
        },
        newInstance: () => new VeryLongTableNameTestClass
      })

      schema.addTable('very_long_table_name_with_63_characters_of_length_defghijklmnop', {
        columns: {
          'column1': 'property1'
        },
        newInstance: () => new VeryLongTableNameTestClass
      })

      let orm = new Orm(schema, db)

      let entities = await orm.load(queryFn, schema.getTable('very_long_table_name_with_63_characters_of_length_0123456789abc'), {
        relationship1: {
          '@load': true,
          property1: 1
        }
      })

      expect(entities.length).to.equal(1)
      expect(entities[0]).to.deep.equal({
        property1: 1,
        relationship1: {
          property1: 1
        }
      })

      await queryFn('DROP TABLE very_long_table_name_with_63_characters_of_length_0123456789abc')
      await queryFn('DROP TABLE very_long_table_name_with_63_characters_of_length_defghijklmnop')
    })
  })
}

class VeryLongTableNameTestClass {
  property1?: number
}