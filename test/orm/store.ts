import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import { Change } from 'knight-change'
import 'mocha'
import { Orm, SelectResult } from '../../src'
import { Object1, schema } from '../testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

export function storeTests(db: string, queryFn: (sqlString: string, values?: any[]) => Promise<any>) {  
  let orm = new Orm(schema, db)
  
  describe('store', function() {
    it('insert simple object', async function() {
      let obj1 = {
        property1: 'a'
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create')
      ])

      let result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(result.length).to.equal(1)
      expect(result[0]).to.deep.equal({
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

    it('insert many-to-one primary key generated', async function() {
      let obj1 = {
        property1: 'a',
        manyToOneObject1: {
          property1: 'b'
        }
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 3,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: 2,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToOneObject1: {
          id: 2,
          property1: 'b',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }
      })

      expect(changes).to.deep.equal([
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
        }, 'create'),
        new Change('Object1', {
          id: 3,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: 2,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(2)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'c',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: 1,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('insert many-to-one primary key not generated', async function() {
      let obj1 = {
        property1: 'a',
        manyToOneObject2: {
          id: 'x',
          property1: 'b'
        }
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: 'x',
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToOneObject2: {
          id: 'x',
          property1: 'b',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: null
        }
      })

      expect(changes).to.deep.equal([
        new Change('Object2', {
          id: 'x',
          property1: 'b',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: 'x',
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: 'y',
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'y',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('insert one-to-one primary key generated', async function() {
      let obj1 = {
        property1: 'a',
        oneToOneObject1: {
          property1: 'b'
        }
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 3,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: 2,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        oneToOneObject1: {
          id: 2,
          property1: 'b',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: 3,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }
      })

      expect(changes).to.deep.equal([
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
        }, 'create'),
        new Change('Object1', {
          id: 3,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: 2,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 2,
          oneToOneObject1Id: 3
        }, 'update', [ 'oneToOneObject1Id' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(2)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'c',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 2,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 1,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('insert one-to-one primary key generated references back', async function() {
      let obj1 = {
        property1: 'a',
        oneToOneObject1: {
          property1: 'b',
          oneToOneObject1: {}
        }
      }

      obj1.oneToOneObject1.oneToOneObject1 = obj1

      let changes = await orm.store(queryFn, Object1, obj1)

      let expectedObj1 = {
        id: 3,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: 2,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        oneToOneObject1: {
          id: 2,
          property1: 'b',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: 3,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        } as any
      }
      
      expectedObj1.oneToOneObject1.oneToOneObject1 = expectedObj1

      expect(obj1).to.deep.equal(expectedObj1)

      expect(changes).to.deep.equal([
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
        }, 'create'),
        new Change('Object1', {
          id: 3,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: 2,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 2,
          oneToOneObject1Id: 3
        }, 'update', [ 'oneToOneObject1Id' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(2)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'c',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 2,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 1,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('insert one-to-one references the same entity', async function() {
      let obj1 = {
        property1: 'a',
        oneToOneObject1: {}
      }

      obj1.oneToOneObject1 = obj1

      let changes = await orm.store(queryFn, Object1, obj1)

      let expectedObj1 = {
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: 2,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
      } as any
      
      expectedObj1.oneToOneObject1 = expectedObj1

      expect(obj1).to.deep.equal(expectedObj1)

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 2,
          oneToOneObject1Id: 2
        }, 'update', [ 'oneToOneObject1Id' ]),
        new Change('Object1', {
          id: 2,
          oneToOneObject1Id: 2
        }, 'update', [ 'oneToOneObject1Id' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: 1,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })
    })

    it('insert one-to-one primary key not generated', async function() {
      let obj1 = {
        property1: 'a',
        oneToOneObject2: {
          id: 'x',
          property1: 'b'
        }
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: 'x',
        oneToManyObject1ManyToOneId: null,
        oneToOneObject2: {
          id: 'x',
          property1: 'b',
          property2: null,
          property3: null,
          oneToOneObject1Id: 2,
          oneToManyObject2ManyToOneId: null
        }
      })

      expect(changes).to.deep.equal([
        new Change('Object2', {
          id: 'x',
          property1: 'b',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: 'x',
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object2', {
          id: 'x',
          oneToOneObject1Id: 2
        }, 'update', [ 'oneToOneObject1Id' ])
      ])

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
        one_to_one_object2_id: 'y',
        one_to_many_object1_many_to_one_id: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'y',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: 1,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('insert one-to-one primary key not generated references back', async function() {
      let obj1 = {
        property1: 'a',
        oneToOneObject2: {
          id: 'x',
          property1: 'b',
          oneToOneObject1: {}
        }
      }

      obj1.oneToOneObject2.oneToOneObject1 = obj1

      let changes = await orm.store(queryFn, Object1, obj1)

      let expectObj1 = {
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: 'x',
        oneToManyObject1ManyToOneId: null,
        oneToOneObject2: {
          id: 'x',
          property1: 'b',
          property2: null,
          property3: null,
          oneToOneObject1Id: 2,
          oneToManyObject2ManyToOneId: null
        } as any
      }

      expectObj1.oneToOneObject2.oneToOneObject1 = expectObj1

      expect(obj1).to.deep.equal(expectObj1)

      expect(changes).to.deep.equal([
        new Change('Object2', {
          id: 'x',
          property1: 'b',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: 'x',
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object2', {
          id: 'x',
          oneToOneObject1Id: 2
        }, 'update', [ 'oneToOneObject1Id' ])
      ])

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
        one_to_one_object2_id: 'y',
        one_to_many_object1_many_to_one_id: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'y',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: 1,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('insert one-to-many primary key generated', async function() {
      let obj1 = {
        property1: 'a',
        oneToManyObject1: [
          {
            property1: 'b'
          },
          {
            property1: 'c'
          }
        ]
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2,
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
            id: 3,
            property1: 'b',
            property2: null,
            property3: null,
            manyToOneObject1Id: null,
            manyToOneObject2Id: null,
            oneToOneObject1Id: null,
            oneToOneObject2Id: null,
            oneToManyObject1ManyToOneId: 2
          },
          {
            id: 4,
            property1: 'c',
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

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 3,
          property1: 'b',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: 2
        }, 'create'),
        new Change('Object1', {
          id: 4,
          property1: 'c',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: 2
        }, 'create')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
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
        one_to_many_object1_many_to_one_id: 1
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'd',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: 1
      })
    })

    it('insert one-to-many primary key generated references back', async function() {
      let obj1 = {
        property1: 'a',
        oneToManyObject1: [
          {
            property1: 'b',
            oneToManyObject1ManyToOne: {}
          },
          {
            property1: 'c',
            oneToManyObject1ManyToOne: {}
          }
        ]
      }

      obj1.oneToManyObject1[0].oneToManyObject1ManyToOne = obj1
      obj1.oneToManyObject1[1].oneToManyObject1ManyToOne = obj1
      
      let changes = await orm.store(queryFn, Object1, obj1)

      let expectedObj1 = {
        id: 2,
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
            id: 3,
            property1: 'b',
            property2: null,
            property3: null,
            manyToOneObject1Id: null,
            manyToOneObject2Id: null,
            oneToOneObject1Id: null,
            oneToOneObject2Id: null,
            oneToManyObject1ManyToOneId: 2,
          } as any,
          {
            id: 4,
            property1: 'c',
            property2: null,
            property3: null,
            manyToOneObject1Id: null,
            manyToOneObject2Id: null,
            oneToOneObject1Id: null,
            oneToOneObject2Id: null,
            oneToManyObject1ManyToOneId: 2,
          }
        ]
      }

      expectedObj1.oneToManyObject1[0].oneToManyObject1ManyToOne = expectedObj1
      expectedObj1.oneToManyObject1[1].oneToManyObject1ManyToOne = expectedObj1

      expect(obj1).to.deep.equal(expectedObj1)

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 3,
          property1: 'b',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: 2
        }, 'create'),
        new Change('Object1', {
          id: 4,
          property1: 'c',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: 2
        }, 'create')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
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
        one_to_many_object1_many_to_one_id: 1
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'd',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: 1
      })
    })

    it('insert one-to-many primary key not generated', async function() {
      let obj1 = {
        property1: 'a',
        oneToManyObject2: [
          {
            id: 'x',
            property1: 'b'
          },
          {
            id: 'y',
            property1: 'c'
          }
        ]
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        oneToManyObject2: [
          {
            id: 'x',
            property1: 'b',
            property2: null,
            property3: null,
            oneToOneObject1Id: null,
            oneToManyObject2ManyToOneId: 2
            } as any,
          {
            id: 'y',
            property1: 'c',
            property2: null,
            property3: null,
            oneToOneObject1Id: null,
            oneToManyObject2ManyToOneId: 2
            }
        ]
      })

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object2', {
          id: 'x',
          property1: 'b',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: 2
        }, 'create'),
          new Change('Object2', {
            id: 'y',
            property1: 'c',
            property2: null,
            property3: null,
            oneToOneObject1Id: null,
            oneToManyObject2ManyToOneId: 2
        }, 'create')
      ])

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
        one_to_many_object1_many_to_one_id: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(2)
      
      expect(table2Result[0]).to.deep.equal({
        id: 'y',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'z',
        column1: 'd',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })
    })

    it('insert one-to-many primary key not generated references back', async function() {
      let obj1 = {
        property1: 'a',
        oneToManyObject2: [
          {
            id: 'x',
            property1: 'b',
            oneToManyObject2ManyToOne: {}
          },
          {
            id: 'y',
            property1: 'c',
            oneToManyObject2ManyToOne: {}
          }
        ]
      }

      obj1.oneToManyObject2[0].oneToManyObject2ManyToOne = obj1
      obj1.oneToManyObject2[1].oneToManyObject2ManyToOne = obj1

      let changes = await orm.store(queryFn, Object1, obj1)

      let expectedObj1 = {
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        oneToManyObject2: [
          {
            id: 'x',
            property1: 'b',
            property2: null,
            property3: null,
            oneToOneObject1Id: null,
            oneToManyObject2ManyToOneId: 2
            } as any,
          {
            id: 'y',
            property1: 'c',
            property2: null,
            property3: null,
            oneToOneObject1Id: null,
            oneToManyObject2ManyToOneId: 2
            }
        ]
      }

      expectedObj1.oneToManyObject2[0].oneToManyObject2ManyToOne = expectedObj1
      expectedObj1.oneToManyObject2[1].oneToManyObject2ManyToOne = expectedObj1

      expect(obj1).to.deep.equal(expectedObj1)

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object2', {
          id: 'x',
          property1: 'b',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: 2
        }, 'create'),
          new Change('Object2', {
            id: 'y',
            property1: 'c',
            property2: null,
            property3: null,
            oneToOneObject1Id: null,
            oneToManyObject2ManyToOneId: 2
        }, 'create')
      ])

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
        one_to_many_object1_many_to_one_id: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(2)
      
      expect(table2Result[0]).to.deep.equal({
        id: 'y',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'z',
        column1: 'd',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })
    })

    it('insert one-to-many references same entity', async function() {
      let obj1 = {
        property1: 'a',
        oneToManyObject1: null
      } as any

      obj1.oneToManyObject1 = [ obj1 ]

      let changes = await orm.store(queryFn, Object1, obj1)

      let expectedObj1 = {
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: 2,
        oneToManyObject1: null
      } as any

      expectedObj1.oneToManyObject1 = [ expectedObj1 ]

      expect(obj1).to.deep.equal(expectedObj1)

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 2,
          oneToManyObject1ManyToOneId: 2
        }, 'update', [ 'oneToManyObject1ManyToOneId' ])
      ])

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
        one_to_many_object1_many_to_one_id: 1
      })
    })

    it('insert many-to-many primary key generated', async function() {
      let obj1 = {
        property1: 'a',
        manyToManyObject1: [
          {
            property1: 'b',
            object12: {
              property1: 'c'
            }
          },
          {
            property1: 'd',
            object12: {
              property1: 'e'
            }
          }
        ]
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToManyObject1: [
          {
            object1Id1: 2,
            object1Id2: 3,
            property1: 'b',
            property2: null,
            property3: null,
            object12: {
              id: 3,
              property1: 'c',
              property2: null,
              property3: null,
              manyToOneObject1Id: null,
              manyToOneObject2Id: null,
              oneToOneObject1Id: null,
              oneToOneObject2Id: null,
              oneToManyObject1ManyToOneId: null
            }
          },
          {
            object1Id1: 2,
            object1Id2: 4,
            property1: 'd',
            property2: null,
            property3: null,
            object12: {
              id: 4,
              property1: 'e',
              property2: null,
              property3: null,
              manyToOneObject1Id: null,
              manyToOneObject2Id: null,
              oneToOneObject1Id: null,
              oneToOneObject2Id: null,
              oneToManyObject1ManyToOneId: null
            }
          }
        ]
      })

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 3,
          property1: 'c',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('ManyToManyObject1', {
          object1Id1: 2,
          object1Id2: 3,
          property1: 'b',
          property2: null,
          property3: null,
        }, 'create'),
        new Change('Object1', {
          id: 4,
          property1: 'e',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('ManyToManyObject1', {
          object1Id1: 2,
          object1Id2: 4,
          property1: 'd',
          property2: null,
          property3: null,
        }, 'create'),
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'd',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'f',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      let tableManyResult = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM many_to_many_table1 ORDER BY table1_id1') as SelectResult

      expect(tableManyResult.length).to.equal(2)

      expect(tableManyResult[0]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 2,
        column1: 'c',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 3,
        column1: 'e',
        column2: null,
        column3: null
      })
    })

    it('insert many-to-many primary key generated references back', async function() {
      let obj1 = {
        property1: 'a',
        manyToManyObject1: [
          {
            property1: 'b',
            object11: {},
            object12: {
              property1: 'c'
            } as any
          },
          {
            property1: 'd',
            object11: {},
            object12: {
              property1: 'e'
            }
          }
        ]
      }

      obj1.manyToManyObject1[0].object11 = obj1
      obj1.manyToManyObject1[0].object12.manyToManyObject1 = [ obj1.manyToManyObject1[0] ]
      obj1.manyToManyObject1[1].object11 = obj1
      obj1.manyToManyObject1[1].object12.manyToManyObject1 = [ obj1.manyToManyObject1[1] ]

      let changes = await orm.store(queryFn, Object1, obj1)

      let expectedObj1 = {
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToManyObject1: [
          {
            object1Id1: 2,
            object1Id2: 3,
            property1: 'b',
            property2: null,
            property3: null,
            object12: {
              id: 3,
              property1: 'c',
              property2: null,
              property3: null,
              manyToOneObject1Id: null,
              manyToOneObject2Id: null,
              oneToOneObject1Id: null,
              oneToOneObject2Id: null,
              oneToManyObject1ManyToOneId: null
            } as any
          } as any,
          {
            object1Id1: 2,
            object1Id2: 4,
            property1: 'd',
            property2: null,
            property3: null,
            object12: {
              id: 4,
              property1: 'e',
              property2: null,
              property3: null,
              manyToOneObject1Id: null,
              manyToOneObject2Id: null,
              oneToOneObject1Id: null,
              oneToOneObject2Id: null,
              oneToManyObject1ManyToOneId: null
            }
          }
        ]
      }

      expectedObj1.manyToManyObject1[0].object11 = expectedObj1
      expectedObj1.manyToManyObject1[0].object12.manyToManyObject1 = [ expectedObj1.manyToManyObject1[0] ]
      expectedObj1.manyToManyObject1[1].object11 = expectedObj1
      expectedObj1.manyToManyObject1[1].object12.manyToManyObject1 = [ expectedObj1.manyToManyObject1[1] ]

      expect(obj1).to.deep.equal(expectedObj1)

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object1', {
          id: 3,
          property1: 'c',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('ManyToManyObject1', {
          object1Id1: 2,
          object1Id2: 3,
          property1: 'b',
          property2: null,
          property3: null,
        }, 'create'),
        new Change('Object1', {
          id: 4,
          property1: 'e',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('ManyToManyObject1', {
          object1Id1: 2,
          object1Id2: 4,
          property1: 'd',
          property2: null,
          property3: null,
        }, 'create'),
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'd',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'f',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null
      })

      let tableManyResult = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM many_to_many_table1 ORDER BY table1_id1') as SelectResult

      expect(tableManyResult.length).to.equal(2)

      expect(tableManyResult[0]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 2,
        column1: 'c',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 3,
        column1: 'e',
        column2: null,
        column3: null
      })
    })

    it('insert many-to-many references the same entity', async function() {
      let obj1 = {
        property1: 'a',
        manyToManyObject1: [
          {
            property1: 'b',
            object12: {}
          }
        ]
      }

      obj1.manyToManyObject1[0].object12 = obj1

      let changes = await orm.store(queryFn, Object1, obj1)

      let expectedObj1 = {
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToManyObject1: [
          {
            object1Id1: 2,
            object1Id2: 2,
            property1: 'b',
            property2: null,
            property3: null
          } as any
        ]
      }

      expectedObj1.manyToManyObject1[0].object12 = expectedObj1

      expect(obj1).to.deep.equal(expectedObj1)

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('ManyToManyObject1', {
          object1Id1: 2,
          object1Id2: 2,
          property1: 'b',
          property2: null,
          property3: null,
        }, 'create')
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

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
        one_to_many_object1_many_to_one_id: null
      })

      let tableManyResult = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM many_to_many_table1 ORDER BY column1') as SelectResult

      expect(tableManyResult.length).to.equal(1)

      expect(tableManyResult[0]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 1,
        column1: 'c',
        column2: null,
        column3: null
      })
    })

    it('insert many-to-many primary key not generated', async function() {
      let obj1 = {
        property1: 'a',
        manyToManyObject2: [
          {
            property1: 'b',
            object2: {
              id: 'x',
              property1: 'c'
            }
          },
          {
            property1: 'd',
            object2: {
              id: 'y',
              property1: 'e'
            }
          }
        ]
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToManyObject2: [
          {
            object1Id: 2,
            object2Id: 'x',
            property1: 'b',
            property2: null,
            property3: null,
            object2: {
              id: 'x',
              property1: 'c',
              property2: null,
              property3: null,
              oneToOneObject1Id: null,
              oneToManyObject2ManyToOneId: null
                } as any
          } as any,
          {
            object1Id: 2,
            object2Id: 'y',
            property1: 'd',
            property2: null,
            property3: null,
            object2: {
              id: 'y',
              property1: 'e',
              property2: null,
              property3: null,
              oneToOneObject1Id: null,
              oneToManyObject2ManyToOneId: null
            }
          }
        ]
      })

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object2', {
          id: 'x',
          property1: 'c',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: null
        }, 'create'),
        new Change('ManyToManyObject2', {
          object1Id: 2,
          object2Id: 'x',
          property1: 'b',
          property2: null,
          property3: null,
        }, 'create'),
        new Change('Object2', {
          id: 'y',
          property1: 'e',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: null
        }, 'create'),
        new Change('ManyToManyObject2', {
          object1Id: 2,
          object2Id: 'y',
          property1: 'd',
          property2: null,
          property3: null,
        }, 'create'),
      ])

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
        one_to_many_object1_many_to_one_id: null
      })

      let tableManyResult = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM many_to_many_table2 ORDER BY table1_id') as SelectResult

      expect(tableManyResult.length).to.equal(2)

      expect(tableManyResult[0]).to.deep.equal({
        table1_id: 1,
        table2_id: 'y',
        column1: 'c',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id: 1,
        table2_id: 'z',
        column1: 'e',
        column2: null,
        column3: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2 ORDER BY id') as SelectResult

      expect(table2Result.length).to.equal(2)
      
      expect(table2Result[0]).to.deep.equal({
        id: 'y',
        column1: 'd',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'z',
        column1: 'f',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('insert many-to-many primary key not generated references back', async function() {
      let obj1 = {
        property1: 'a',
        manyToManyObject2: [
          {
            property1: 'b',
            object1: {},
            object2: {
              id: 'x',
              property1: 'c',
              manyToManyObject2: []
            } as any
          },
          {
            property1: 'd',
            object1: {},
            object2: {
              id: 'y',
              property1: 'e',
              manyToManyObject2: []
            }
          }
        ]
      }

      obj1.manyToManyObject2[0].object1 = obj1
      obj1.manyToManyObject2[0].object2.manyToManyObject2.push(obj1.manyToManyObject2[0])
      obj1.manyToManyObject2[1].object1 = obj1
      obj1.manyToManyObject2[1].object2.manyToManyObject2.push(obj1.manyToManyObject2[1])

      let changes = await orm.store(queryFn, Object1, obj1)

      let expectedObj1 = {
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToManyObject2: [
          {
            object1Id: 2,
            object2Id: 'x',
            property1: 'b',
            property2: null,
            property3: null,
            object2: {
              id: 'x',
              property1: 'c',
              property2: null,
              property3: null,
              oneToOneObject1Id: null,
              oneToManyObject2ManyToOneId: null
                } as any
          } as any,
          {
            object1Id: 2,
            object2Id: 'y',
            property1: 'd',
            property2: null,
            property3: null,
            object2: {
              id: 'y',
              property1: 'e',
              property2: null,
              property3: null,
              oneToOneObject1Id: null,
              oneToManyObject2ManyToOneId: null
            }
          }
        ]
      }

      expectedObj1.manyToManyObject2[0].object1 = obj1
      expectedObj1.manyToManyObject2[0].object2.manyToManyObject2 = [ expectedObj1.manyToManyObject2[0] ]
      expectedObj1.manyToManyObject2[1].object1 = obj1
      expectedObj1.manyToManyObject2[1].object2.manyToManyObject2 = [ expectedObj1.manyToManyObject2[1] ]

      expect(obj1).to.deep.equal(expectedObj1)

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'a',
          property2: null,
          property3: null,
          manyToOneObject1Id: null,
          manyToOneObject2Id: null,
          oneToOneObject1Id: null,
          oneToOneObject2Id: null,
          oneToManyObject1ManyToOneId: null
        }, 'create'),
        new Change('Object2', {
          id: 'x',
          property1: 'c',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: null
        }, 'create'),
        new Change('ManyToManyObject2', {
          object1Id: 2,
          object2Id: 'x',
          property1: 'b',
          property2: null,
          property3: null,
        }, 'create'),
        new Change('Object2', {
          id: 'y',
          property1: 'e',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: null
        }, 'create'),
        new Change('ManyToManyObject2', {
          object1Id: 2,
          object2Id: 'y',
          property1: 'd',
          property2: null,
          property3: null,
        }, 'create'),
      ])

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
        one_to_many_object1_many_to_one_id: null
      })

      let tableManyResult = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM many_to_many_table2 ORDER BY table1_id') as SelectResult

      expect(tableManyResult.length).to.equal(2)

      expect(tableManyResult[0]).to.deep.equal({
        table1_id: 1,
        table2_id: 'y',
        column1: 'c',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id: 1,
        table2_id: 'z',
        column1: 'e',
        column2: null,
        column3: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2 ORDER BY id') as SelectResult

      expect(table2Result.length).to.equal(2)
      
      expect(table2Result[0]).to.deep.equal({
        id: 'y',
        column1: 'd',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'z',
        column1: 'f',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('update simple obj', async function() {
      await queryFn('INSERT INTO table1 (column1) VALUES (\'a\')')

      let obj1 = {
        id: 2,
        property1: 'b'
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })

      expect(changes).to.deep.equal([
        new Change('Object1', {
          id: 2,
          property1: 'b',
        }, 'update', [ 'property1' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
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

    it('not update simple obj if nothing to set is given', async function() {
      await queryFn('INSERT INTO table1 (column1) VALUES (\'b\')')

      let obj1 = {
        id: 2
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2,
        property1: 'a',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: null,
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null
      })

      expect(changes).to.deep.equal([])

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

    it('update many-to-one primary key not generated', async function() {
      await queryFn('INSERT INTO table1 (column1, many_to_one_object2_id) VALUES (\'b\', \'y\')')
      await queryFn('INSERT INTO table2 (id, column1) VALUES (\'y\', \'c\')')

      let obj1 = {
        id: 2,
        property1: 'b',
        manyToOneObject2: {
          id: 'x',
          property1: 'c'
        }
      }

      let changes = await orm.store(queryFn, Object1, obj1)

      expect(obj1).to.deep.equal({
        id: 2,
        property1: 'b',
        property2: null,
        property3: null,
        manyToOneObject1Id: null,
        manyToOneObject2Id: 'x',
        oneToOneObject1Id: null,
        oneToOneObject2Id: null,
        oneToManyObject1ManyToOneId: null,
        manyToOneObject2: {
          id: 'x',
          property1: 'c',
          property2: null,
          property3: null,
          oneToOneObject1Id: null,
          oneToManyObject2ManyToOneId: null
        }
      })

      expect(changes).to.deep.equal([
        new Change('Object2', {
          id: 'x',
          property1: 'c'
        }, 'update', [ 'property1' ]),
        new Change('Object1', {
          id: 2,
          property1: 'b'
        }, 'update', [ 'property1' ])
      ])

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'c',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: 'y',
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'y',
        column1: 'd',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })
  })
}
