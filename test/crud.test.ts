import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { create, delete_, read, update } from '../src/crud'
import { ManyToMany, Object1, Object2, schema } from './testSchema'

chai.use(chaiAsPromised)
const expect = chai.expect

let pool: Pool = new Pool({
  host: 'postgres',
  database: 'sqlorm_test',
  user: 'sqlorm_test',
  password: 'sqlorm_test'
} as PoolConfig)

describe('crud', function() {
  describe('PostgreSQL', function () {
    after(async function() {
      await pool.end()
    })

    beforeEach(async function() {
      await pool.query('CREATE TABLE table1 (id SERIAL, column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP, many_to_one_id VARCHAR(20), many_to_one_recursive_id INTEGER, one_to_one_id VARCHAR(20), one_to_one_recursive_id INTEGER, one_to_many_recursive_id INTEGER)')
      await pool.query('CREATE TABLE table2 (id VARCHAR(20), column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP, one_to_one_id INTEGER, one_to_many_id INTEGER)')
      await pool.query('CREATE TABLE many_to_many (table1_id INTEGER, table2_id VARCHAR(20), column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP)')
      await pool.query('CREATE TABLE many_to_many_recursive (table11_id INTEGER, table12_id INTEGER, column1 VARCHAR(20), column2 INTEGER, column3 TIMESTAMP)')
    })

    afterEach(async function() {
      await pool.query('DROP TABLE IF EXISTS table1 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table2 CASCADE')
      await pool.query('DROP TABLE IF EXISTS many_to_many CASCADE')
      await pool.query('DROP TABLE IF EXISTS many_to_many_recursive CASCADE')
    })
    
  //   describe('create', function() {
  //     it('should create an instance with relationships', async function() {
  //       let object1 = new Object1
  //       object1.property = 'a'
  //       object1.manyToMany = [ new ManyToMany, new ManyToMany ]
  //       object1.object1 = {
  //         property1: 'b',
  //         property2: 2
  //       }
  //       object1.object2 = {
  //         id: 'x',
  //         property1: 'c'
  //       }

  //       object1.manyToMany[0].property = 'd'
  //       object1.manyToMany[0].object1 = object1
  //       object1.manyToMany[0].object2 = object1.object2
  //       object1.manyToMany[0].object2.object1 = object1
  //       object1.manyToMany[0].object12 = object1

  //       object1.manyToMany[1].property = 'e'
  //       object1.manyToMany[1].object1 = object1
  //       object1.manyToMany[1].object2 = new Object2
  //       object1.manyToMany[1].object2.id = 'y'
  //       object1.manyToMany[1].object2.property = 'f'
  //       object1.manyToMany[1].object2.object1 = object1
  //       object1.manyToMany[1].object2.manyToMany = [ object1.manyToMany[1] ]

  //       object1.object1.object1 = object1
  //       object1.object1.object2 = object1.object2
        
  //       let createdInstance = await create(schema, 'table1', 'postgres', pgQueryFn, object1)

  //       let expectedInstance = {
  //         id: 1,
  //         property1: 'a',
  //         property2: 1,
  //         object1Id: 2,
  //         object2Id: 'x',
  //         object1: {
  //           id: 2,
  //           property1: 'b',
  //           property2: 2,
  //           object1Id: 1,
  //           object2Id: 'x'
  //         } as any,
  //         object2: {
  //           id: 'x',
  //           property1: 'c',
  //           object1Id: 1
  //         } as any,
  //         manyObjects: [
  //           {
  //             object1Id: 1,
  //             object2Id: 'x',
  //             property1: 'd',
  //             object1Id2: 1,
  //             object2: {
  //               id: 'x',
  //               property1: 'c',
  //               object1Id: 1
  //             }
  //           } as any,
  //           {
  //             object1Id: 1,
  //             object2Id: 'y',
  //             property1: 'e',
  //             object1Id2: null,
  //             object2: {
  //               id: 'y',
  //               property1: 'f',
  //               object1Id: 1
  //             }
  //           }
  //         ]
  //       }

  //       expectedInstance.object1.object1 = expectedInstance
  //       expectedInstance.object1.object2 = expectedInstance.object2
  //       expectedInstance.object2.object1 = expectedInstance
  //       expectedInstance.manyToMany[0].object1 = expectedInstance
  //       expectedInstance.manyToMany[0].object2 = expectedInstance.object2
  //       expectedInstance.manyToMany[0].object12 = expectedInstance
  //       expectedInstance.manyToMany[1].object1 = expectedInstance
  //       expectedInstance.manyToMany[1].object2.object1 = expectedInstance        

  //       expect(createdInstance).to.deep.equal(expectedInstance)
  //       expect(createdInstance).to.be.instanceOf(Object1)
  //       expect(createdInstance.manyToMany).to.be.not.undefined

  //       if (createdInstance.manyToMany == undefined) {
  //         return
  //       }

  //       expect(createdInstance.manyToMany[0].object1).to.be.instanceOf(Object1)
  //       expect(createdInstance.manyToMany[0].object12).to.be.instanceOf(Object1)
  //       expect(createdInstance.manyToMany[1].object1).to.be.instanceOf(Object1)
  //       expect(createdInstance.object1).to.be.instanceOf(Object1)
  //       expect(createdInstance.object2).to.be.instanceOf(Object2)
  //     })
  //   })

  //   describe('read', function() {
  //     it('should read an instance with relationship', async function() {
  //       let object1 = new Object1
  //       object1.property = 'a'
  //       object1.property2 = 1
  //       object1.manyToMany = [ new ManyToMany, new ManyToMany ]

  //       object1.object1 = {
  //         property1: 'b',
  //         property2: 2
  //       }

  //       object1.object2 = {
  //         id: 'x',
  //         property1: 'c'
  //       }

  //       object1.manyToMany[0].property = 'd'
  //       object1.manyToMany[0].object1 = object1
  //       object1.manyToMany[0].object2 = object1.object2
  //       object1.manyToMany[0].object2.object1 = object1
  //       object1.manyToMany[0].object12 = object1

  //       object1.manyToMany[1].property = 'e'
  //       object1.manyToMany[1].object1 = object1
  //       object1.manyToMany[1].object2 = new Object2
  //       object1.manyToMany[1].object2.id = 'y'
  //       object1.manyToMany[1].object2.property = 'f'
  //       object1.manyToMany[1].object2.object1 = object1
  //       object1.manyToMany[1].object2.manyToMany = [ object1.manyToMany[1] ]

  //       object1.object1.object1 = object1
  //       object1.object1.object2 = object1.object2
        
  //       await create(schema, 'table1', 'postgres', pgQueryFn, object1)

  //       let criteria = {
  //         id: 1,
  //         manyObjects: {
  //           object1: {},
  //           object2: {}
  //         },
  //         object1: {
  //           object1: {},
  //           object2: {}
  //         },
  //         object2: {}
  //       }  

  //       let instances: any[] = await read(schema, 'table1', 'postgres', pgQueryFn, criteria)

  //       let expectedInstance = {
  //         id: 1,
  //         property1: 'a',
  //         property2: 1,
  //         object1Id: 2,
  //         object2Id: 'x',
  //         object1: {
  //           id: 2,
  //           property1: 'b',
  //           property2: 2,
  //           object1Id: 1,
  //           object2Id: 'x'
  //         },
  //         object2: {
  //           id: 'x',
  //           property1: 'c',
  //           object1Id: 1
  //         },
  //         manyObjects: [
  //           {
  //             object1Id: 1,
  //             object2Id: 'x',
  //             property1: 'd',
  //             object1Id2: 1
  //           },
  //           {
  //             object1Id: 1,
  //             object2Id: 'y',
  //             property1: 'e',
  //             object1Id2: null,
  //             object2: {
  //               id: 'y',
  //               property1: 'f',
  //               object1Id: 1
  //             }
  //           }
  //         ]
  //       } as any

  //       expectedInstance.object1.object1 = expectedInstance
  //       expectedInstance.object1.object2 = expectedInstance.object2
  //       expectedInstance.manyToMany[0].object1 = expectedInstance
  //       expectedInstance.manyToMany[0].object2 = expectedInstance.object2
  //       expectedInstance.manyToMany[1].object1 = expectedInstance

  //       expect(instances.length).to.equal(1)
  //       expect(instances[0]).to.deep.equal(expectedInstance)
  //     })
  //   })

  //   describe('update', function() {
  //     it('should update an instance with relationships', async function() {
  //       let object1 = new Object1
  //       object1.property = 'a'
  //       object1.property2 = 1
  //       object1.manyToMany = [ new ManyToMany, new ManyToMany ]

  //       object1.object1 = {
  //         property1: 'b',
  //         property2: 2
  //       }

  //       object1.object2 = {
  //         id: 'x',
  //         property1: 'c'
  //       }

  //       object1.manyToMany[0].property = 'd'
  //       object1.manyToMany[0].object1 = object1
  //       object1.manyToMany[0].object2 = object1.object2
  //       object1.manyToMany[0].object2.object1 = object1
  //       object1.manyToMany[0].object12 = object1

  //       object1.manyToMany[1].property = 'e'
  //       object1.manyToMany[1].object1 = object1
  //       object1.manyToMany[1].object2 = new Object2
  //       object1.manyToMany[1].object2.id = 'y'
  //       object1.manyToMany[1].object2.property = 'f'
  //       object1.manyToMany[1].object2.object1 = object1
  //       object1.manyToMany[1].object2.manyToMany = [ object1.manyToMany[1] ]

  //       object1.object1.object1 = object1
  //       object1.object1.object2 = object1.object2
        
  //       await create(schema, 'table1', 'postgres', pgQueryFn, object1)

  //       let updateObject1 = new Object1
  //       updateObject1.id = 1
  //       updateObject1.property = 'g'
  //       updateObject1.property2 = 3

  //       updateObject1.object1 = {
  //         id: 2,
  //         property1: 'h',
  //         property2: 4
  //       }

  //       updateObject1.object2 = {
  //         id: 'x',
  //         property1: 'i'
  //       }

  //       updateObject1.manyToMany = [ new ManyToMany, new ManyToMany ]

  //       updateObject1.manyToMany[0].object1Id = 1
  //       updateObject1.manyToMany[0].object2Id = 'x'
  //       updateObject1.manyToMany[0].property = 'j'
  //       updateObject1.manyToMany[0].object1 = updateObject1
  //       updateObject1.manyToMany[0].object2 = updateObject1.object2
  //       updateObject1.manyToMany[0].object12 = updateObject1

  //       updateObject1.manyToMany[1].object1Id = 1
  //       updateObject1.manyToMany[1].object2Id = 'y'
  //       updateObject1.manyToMany[1].property = 'k'
  //       updateObject1.manyToMany[1].object1 = updateObject1
  //       updateObject1.manyToMany[1].object2 = new Object2
  //       updateObject1.manyToMany[1].object2.id = 'y'
  //       updateObject1.manyToMany[1].object2.property = 'l'
  //       updateObject1.manyToMany[1].object2.manyToMany = [ updateObject1.manyToMany[1] ]

  //       updateObject1.object1.object1 = updateObject1
  //       updateObject1.object1.object2 = updateObject1.object2

  //       let updatedInstance = await update(schema, 'table1', 'postgres', pgQueryFn, updateObject1)

  //       let expectedInstance = {
  //         id: 1,
  //         property1: 'g',
  //         property2: 3,
  //         object1Id: 2,
  //         object2Id: 'x',
  //         object1: {
  //           id: 2,
  //           property1: 'h',
  //           property2: 4,
  //           object1Id: 1,
  //           object2Id: 'x'
  //         } as any,
  //         object2: {
  //           id: 'x',
  //           property1: 'i',
  //           object1Id: 1
  //         },
  //         manyObjects: [
  //           {
  //             object1Id: 1,
  //             object2Id: 'x',
  //             property1: 'j',
  //             object1Id2: 1,
  //             object2: {
  //               id: 'x',
  //               property1: 'i',
  //               object1Id: 1
  //             }
  //           } as any,
  //           {
  //             object1Id: 1,
  //             object2Id: 'y',
  //             property1: 'k',
  //             object1Id2: null,
  //             object2: {
  //               id: 'y',
  //               property1: 'l',
  //               object1Id: 1
  //             }
  //           }
  //         ]
  //       }

  //       expectedInstance.manyToMany[0].object1 = expectedInstance
  //       expectedInstance.manyToMany[0].object12 = expectedInstance
  //       expectedInstance.manyToMany[1].object1 = expectedInstance
  //       expectedInstance.manyToMany[1].object2.manyToMany = [ expectedInstance.manyToMany[1] ]
  //       expectedInstance.object1.object1 = expectedInstance
  //       expectedInstance.object1.object2 = expectedInstance.object2

  //       expect(updatedInstance).to.equal(expectedInstance)
  //     })
  //   })

  //   describe('delete_', function() {
  //     it('should delete in instance with relationships', async function() {
  //       let object1 = new Object1
  //       object1.property = 'a'
  //       object1.property2 = 1
  //       object1.manyToMany = [ new ManyToMany, new ManyToMany ]

  //       object1.object1 = {
  //         property1: 'b',
  //         property2: 2
  //       }

  //       object1.object2 = {
  //         id: 'x',
  //         property1: 'c'
  //       }

  //       object1.manyToMany[0].property = 'd'
  //       object1.manyToMany[0].object1 = object1
  //       object1.manyToMany[0].object2 = object1.object2
  //       object1.manyToMany[0].object12 = object1

  //       object1.manyToMany[1].property = 'e'
  //       object1.manyToMany[1].object1 = object1
  //       object1.manyToMany[1].object2 = new Object2
  //       object1.manyToMany[1].object2.id = 'y'
  //       object1.manyToMany[1].object2.property = 'f'
  //       object1.manyToMany[1].object2.manyToMany = [ object1.manyToMany[1] ]

  //       object1.object1.object1 = object1
  //       object1.object1.object2 = object1.object2
        
  //       await create(schema, 'table1', 'postgres', pgQueryFn, object1)

  //       let deletedInstance = await delete_(schema, 'table1', 'postgres', pgQueryFn, { id: 1 })

  //       let expectedInstance = {
  //         id: 1,
  //         property1: 'a',
  //         property2: 1,
  //         object1Id: 2,
  //         object2Id: 'x',
  //         manyObjects: [
  //           {
  //             object1Id: 1,
  //             object2Id: 'x',
  //             property1: 'd',
  //             object1Id2: 1
  //           } as any,
  //           {
  //             object1Id: 1,
  //             object2Id: 'y',
  //             property1: 'e',
  //             object1Id2: null
  //           }
  //         ],
  //         object1: {
  //           id: 2,
  //           property1: 'b',
  //           property2: 2,
  //           object1Id: 1,
  //           object2Id: 'x'
  //         } as any
  //       }

  //       expect(deletedInstance).to.deep.equal(expectedInstance)
  //     })
  //   })
  })
})

async function pgQueryFn(sqlString: string, values?: any[]): Promise<any[]> {
  let result = await pool.query(sqlString, values)
  return result.rows
}