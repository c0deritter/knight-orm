import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false
      })

      let result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(result.length).to.equal(1)
      expect(result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 2,
        '@update': false,
        manyToOneObject1: {
          id: 1,
          '@update': false
        }
      })

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
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[1]).to.deep.equal({
        id: 2,
        column1: 'a',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToOneObject2: {
          id: 'x',
          '@update': false
        }
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: 'x',
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'b',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 2,
        '@update': false,
        oneToOneObject1: {
          id: 1,
          '@update': false
        }
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(2)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
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
        column1: 'a',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 2,
        '@update': false,
        oneToOneObject1: {
          id: 1,
          '@update': false
        }
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(2)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
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
        column1: 'a',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)
      
      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToOneObject2: {
          id: 'x',
          '@update': false
        }
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: 'x',
        one_to_many_object1_many_to_one_id: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'b',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToOneObject2: {
          id: 'x',
          '@update': false
        }
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: 'x',
        one_to_many_object1_many_to_one_id: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'b',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToManyObject1: [
          {
            id: 2,
            '@update': false
          },
          {
            id: 3,
            '@update': false
          }
        ]
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: 1
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'c',
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
      
      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToManyObject1: [
          {
            id: 2,
            '@update': false
          },
          {
            id: 3,
            '@update': false,
          }
        ]
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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
        many_to_one_object1_id: null,
        many_to_one_object2_id: null,
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: 1
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'c',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToManyObject2: [
          {
            id: 'x',
            '@update': false
          },
          {
            id: 'y',
            '@update': false
          }
        ]
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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
        id: 'x',
        column1: 'b',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'y',
        column1: 'c',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        oneToManyObject2: [
          {
            id: 'x',
            '@update': false
          },
          {
            id: 'y',
            '@update': false
          }
        ]
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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
        id: 'x',
        column1: 'b',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: 1
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'y',
        column1: 'c',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject1: [
          {
            object11Id: 1,
            object12Id: 2,
            '@update': false,
            object12: {
              id: 2,
              '@update': false,
            }
          },
          {
            object11Id: 1,
            object12Id: 3,
            '@update': false,
            object12: {
              id: 3,
              '@update': false,
            }
          }
        ]
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'e',
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
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 3,
        column1: 'd',
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
              property1: 'c',
              manyToManyObject1: []
            } as any
          },
          {
            property1: 'd',
            object11: {},
            object12: {
              property1: 'e',
              manyToManyObject1: []
            }
          }
        ]
      }

      obj1.manyToManyObject1[0].object11 = obj1
      obj1.manyToManyObject1[0].object12.manyToManyObject1.push(obj1.manyToManyObject1[0])
      obj1.manyToManyObject1[1].object11 = obj1
      obj1.manyToManyObject1[1].object12.manyToManyObject1.push(obj1.manyToManyObject1[1])

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject1: [
          {
            object11Id: 1,
            object12Id: 2,
            '@update': false,
            object12: {
              id: 2,
              '@update': false
            }
          },
          {
            object11Id: 1,
            object12Id: 3,
            '@update': false,
            object12: {
              id: 3,
              '@update': false
            }
          }
        ]
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(3)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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
        one_to_many_object1_many_to_one_id: null
      })

      expect(table1Result[2]).to.deep.equal({
        id: 3,
        column1: 'e',
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
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id1: 1,
        table1_id2: 3,
        column1: 'd',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject1: [
          {
            object11Id: 1,
            object12Id: 1,
            '@update': false
          }
        ]
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1 ORDER BY id') as SelectResult

      expect(table1Result.length).to.equal(1)

      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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
        column1: 'b',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject2: [
          {
            object1Id: 1,
            object2Id: 'x',
            '@update': false,
            object2: {
              id: 'x',
              '@update': false,
            }
          },
          {
            object1Id: 1,
            object2Id: 'y',
            '@update': false,
            object2: {
              id: 'y',
              '@update': false
            }
          }
        ]
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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
        table2_id: 'x',
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id: 1,
        table2_id: 'y',
        column1: 'd',
        column2: null,
        column3: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2 ORDER BY id') as SelectResult

      expect(table2Result.length).to.equal(2)
      
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'y',
        column1: 'e',
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

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': false,
        manyToManyObject2: [
          {
            object1Id: 1,
            object2Id: 'x',
            '@update': false,
            object2: {
              id: 'x',
              '@update': false
            }
          },
          {
            object1Id: 1,
            object2Id: 'y',
            '@update': false,
            object2: {
              id: 'y',
              '@update': false
            }
          }
        ]
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'a',
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
        table2_id: 'x',
        column1: 'b',
        column2: null,
        column3: null
      })

      expect(tableManyResult[1]).to.deep.equal({
        table1_id: 1,
        table2_id: 'y',
        column1: 'd',
        column2: null,
        column3: null
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2 ORDER BY id') as SelectResult

      expect(table2Result.length).to.equal(2)
      
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })

      expect(table2Result[1]).to.deep.equal({
        id: 'y',
        column1: 'e',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })

    it('update simple obj', async function() {
      await queryFn('INSERT INTO table1 (column1) VALUES (\'a\')')

      let obj1 = {
        id: 1,
        property1: 'b'
      }

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': true
      })

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
      await queryFn('INSERT INTO table1 (column1) VALUES (\'a\')')
      await queryFn('INSERT INTO table2 (id, column1) VALUES (\'x\', \'b\')', ['x', 'b'])

      let obj1 = {
        id: 1,
        property1: 'b',
        manyToOneObject2: {
          id: 'x',
          property1: 'c'
        }
      }

      let storeInfo = await orm.store(queryFn, Object1, obj1)

      expect(storeInfo).to.deep.equal({
        id: 1,
        '@update': true,
        manyToOneObject2: {
          id: 'x',
          '@update': true
        }
      })

      let table1Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table1') as SelectResult

      expect(table1Result.length).to.equal(1)
      expect(table1Result[0]).to.deep.equal({
        id: 1,
        column1: 'b',
        column2: null,
        column3: null,
        many_to_one_object1_id: null,
        many_to_one_object2_id: 'x',
        one_to_one_object1_id: null,
        one_to_one_object2_id: null,
        one_to_many_object1_many_to_one_id: null,
      })

      let table2Result = await orm.queryTools.databaseIndependentQuery(queryFn, 'SELECT * FROM table2') as SelectResult

      expect(table2Result.length).to.equal(1)
      expect(table2Result[0]).to.deep.equal({
        id: 'x',
        column1: 'c',
        column2: null,
        column3: null,
        one_to_one_object1_id: null,
        one_to_many_object2_many_to_one_id: null
      })
    })
  })
}
