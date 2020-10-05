import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { create, delete_, read, update } from '../src/crud'
import { ManyObjects, Object1, Object2, Object3, Object4, schema } from './testSchema'

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
      await pool.query('CREATE TABLE table1 (id SERIAL, column1 VARCHAR(20), column2 INTEGER)')
      await pool.query('CREATE TABLE table2 (id VARCHAR(20), column1 VARCHAR(20))')
      await pool.query('CREATE TABLE table3 (id SERIAL, column1 VARCHAR(20), table3_id INTEGER)')
      await pool.query('CREATE TABLE table4 (table1_id1 INTEGER, table1_id2 INTEGER)')
      await pool.query('CREATE TABLE table5 (id SERIAL, table5_id INTEGER)')
      await pool.query('CREATE TABLE table6 (table5_id1 INTEGER, table5_id2 INTEGER)')
      await pool.query('CREATE TABLE table_many (table1_id INTEGER, table2_id VARCHAR(20), column1 VARCHAR(20), table1_id2 INTEGER)')
    })

    afterEach(async function() {
      await pool.query('DROP TABLE IF EXISTS table1 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table2 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table3 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table4 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table5 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table6 CASCADE')
      await pool.query('DROP TABLE IF EXISTS table_many CASCADE')
    })
    
    describe('create', function() {
      it('should create a simple instance with PostgreSQL', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 = 1
  
        let createdInstance = await create(schema, 'table1', 'postgres', pgQueryFn, object1)
  
        expect(createdInstance.id).to.equal(1)
        expect(createdInstance.property1).to.equal('a')
        expect(createdInstance.property2).to.equal(1)

        let rows = await pgQueryFn('SELECT * FROM table1')

        expect(rows.length).to.equal(1)
        expect(rows[0].id).to.equal(1)
        expect(rows[0].column1).to.equal('a')
        expect(rows[0].column2).to.equal(1)
      })
  
      it('should create an instance with a many-to-many relationship', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 = 1
        object1.many = [ new ManyObjects, new ManyObjects ]

        object1.many[0].property1 = 'b'
        object1.many[0].object1 = object1
        object1.many[0].object2 = new Object2
        object1.many[0].object2.id = 'x'
        object1.many[0].object2.property1 = 'c'
        object1.many[0].object2.many = [ object1.many[0] ]

        object1.many[1].property1 = 'd'
        object1.many[1].object1 = object1
        object1.many[1].object2 = new Object2
        object1.many[1].object2.id = 'y'
        object1.many[1].object2.property1 = 'e'
        object1.many[1].object2.many = [ object1.many[1] ]
        
        let createdInstance = await create(schema, 'table1', 'postgres', pgQueryFn, object1)

        let expectedInstance = {
          id: 1,
          property1: 'a',
          property2: 1,
          many: [
            {
              object1Id: 1,
              object2Id: 'x',
              property1: 'b',
              object1Id2: null,
              object2: {
                id: 'x',
                property1: 'c'
              }
            } as any,
            {
              object1Id: 1,
              object2Id: 'y',
              property1: 'd',
              object1Id2: null,
              object2: {
                id: 'y',
                property1: 'e'
              }
            }            
          ]
        }

        expectedInstance.many[0].object1 = expectedInstance
        expectedInstance.many[1].object1 = expectedInstance

        expect(createdInstance).to.deep.equal(expectedInstance)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('a')
        expect(table1Rows[0].column2).to.equal(1)

        let tableManyRows = await pgQueryFn('SELECT * FROM table_many')

        expect(tableManyRows.length).to.equal(2)
        expect(tableManyRows[0].table1_id).to.equal(1)
        expect(tableManyRows[0].table2_id).to.equal('x')
        expect(tableManyRows[0].column1).to.equal('b')
        expect(tableManyRows[0].table1_id2).to.be.null
        expect(tableManyRows[1].table1_id).to.equal(1)
        expect(tableManyRows[1].table2_id).to.equal('y')
        expect(tableManyRows[1].column1).to.equal('d')
        expect(tableManyRows[1].table1_id2).to.be.null

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(2)
        expect(table2Rows[0].id).to.equal('x')
        expect(table2Rows[0].column1).to.equal('c')
        expect(table2Rows[1].id).to.equal('y')
        expect(table2Rows[1].column1).to.equal('e')
      })

      it('should create a row with a many-to-one relationship', async function() {
        let manyObjects = new ManyObjects
        manyObjects.property1 = 'a'
        manyObjects.object1 = new Object1
        manyObjects.object1.property1 = 'b'
        manyObjects.object1.property2 = 1
        manyObjects.object2 = new Object2
        manyObjects.object2.id = 'x',
        manyObjects.object2.property1 = 'c'

        manyObjects.object1.many = [ manyObjects ]
        manyObjects.object2.many = [ manyObjects ]
        
        let createdInstance = await create(schema, 'table_many', 'postgres', pgQueryFn, manyObjects)

        expect(createdInstance.object1Id).to.equal(1)
        expect(createdInstance.object2Id).to.equal('x')
        expect(createdInstance.property1).to.equal('a')
        expect(createdInstance.object1).to.deep.equal({
          id: 1,
          property1: 'b',
          property2: 1
        })
        expect(createdInstance.object2).to.deep.equal({
          id: 'x',
          property1: 'c'
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('b')
        expect(table1Rows[0].column2).to.equal(1)

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0].id).to.equal('x')
        expect(table2Rows[0].column1).to.equal('c')
      })

      it('should create a row with a one-to-one relationship', async function() {
        let object3 = new Object3
        object3.property1 = 'a'
        object3.object3 = new Object3
        object3.object3.property1 = 'b'
        object3.object3.object3 = object3

        let createdInstance = await create(schema, 'table3', 'postgres', pgQueryFn, object3)

        expect(createdInstance.id).to.equal(2)
        expect(createdInstance.object3Id).to.equal(1)
        expect(createdInstance.property1).to.equal('a')
        expect(createdInstance.object3).to.deep.equal({
          id: 1,
          property1: 'b',
          object3Id: 2
        })

        let rows = await pgQueryFn('SELECT * FROM table3')

        expect(rows.length).to.equal(2)
        expect(rows[0].id).to.equal(2)
        expect(rows[0].table3_id).to.equal(1)
        expect(rows[0].column1).to.equal('a')
        expect(rows[1].id).to.equal(1)
        expect(rows[1].table3_id).to.equal(2)
        expect(rows[1].column1).to.equal('b')
      })

      it('should not create the same object twice inside many-to-one', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 = 1

        let object4 = new Object4
        object4.object11 = object1
        object4.object12 = object1

        let createdInstance = await create(schema, 'table4', 'postgres', pgQueryFn, object4)

        expect(createdInstance.object1Id1).to.equal(1)
        expect(createdInstance.object1Id2).to.equal(1)
        expect(createdInstance.object11).to.deep.equal({
          id: 1,
          property1: 'a',
          property2: 1
        })
        expect(createdInstance.object12).to.deep.equal({
          id: 1,
          property1: 'a',
          property2: 1
        })
        expect(createdInstance.object11 === createdInstance.object12).to.be.true

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('a')
        expect(table1Rows[0].column2).to.equal(1)
      })

      it('should not insert the same object twice when it is inside one-to-many', async function() {
        let manyObject = new ManyObjects
        manyObject.property1 = 'a'

        let object1 = new Object1
        object1.many = [ manyObject, manyObject, manyObject ]

        let createdInstance = await create(schema, 'table1', 'postgres', pgQueryFn, object1)

        expect(createdInstance.id).to.equal(1)
        expect(createdInstance.many).to.deep.equal([{
          object1Id: 1,
          object2Id: null,
          property1: 'a',
          object1Id2: null
        }])

        let table1Rows = await pgQueryFn('SELECT * FROM table_many')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].table1_id).to.equal(1)
        expect(table1Rows[0].table2_id).to.be.null
        expect(table1Rows[0].column1).to.equal('a')
      })
    })

    describe('read', function() {
      it('should read the one row where the many-to-one relationship is present', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 =  1
        object1.many = [new ManyObjects, new ManyObjects]
        object1.many[0].property1 = 'b'
        object1.many[0].object2 = new Object2
        object1.many[0].object2.id = 'x'
        object1.many[0].object2.property1 = 'c'
        object1.many[1].property1 = 'd'

        await create(schema, 'table1', 'postgres', pgQueryFn, object1)

        let criteria = {
          id: 1,
          property1: 'a',
          many: {
            property1: 'b',
            object2: {
              property1: 'c'
            }
          }
        }  

        let instances = await read(schema, 'table1', 'postgres', pgQueryFn, criteria)

        expect(instances.length).to.equal(1)
        expect(instances[0]).to.deep.equal({
          id: 1,
          property1: 'a',
          property2: 1,
          many: [
            {
              object1Id: 1,
              object2Id: 'x',
              property1: 'b',
              object1Id2: null,
              object2: {
                id: 'x',
                property1: 'c'
              }
            }
          ]
        })
      })

      it('should read the one row where the many-to-one relationship is not present', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 =  1
        object1.many = [new ManyObjects, new ManyObjects]
        object1.many[0].property1 = 'b'
        object1.many[0].object2 = new Object2
        object1.many[0].object2.id = 'x'
        object1.many[0].object2.property1 = 'c'
        object1.many[1].property1 = 'd'

        await create(schema, 'table1', 'postgres', pgQueryFn, object1)

        let criteria = {
          id: 1,
          property1: 'a',
          many: {
            property1: 'd',
            object2: {}
          }
        }  

        let instances = await read(schema, 'table1', 'postgres', pgQueryFn, criteria)

        expect(instances.length).to.equal(1)
        expect(instances[0]).to.deep.equal({
          id: 1,
          property1: 'a',
          property2: 1,
          many: [
            {
              object1Id: 1,
              object2Id: null,
              property1: 'd',
              object1Id2: null
            }
          ]
        })
      })

      it('should read all rows', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 =  1
        object1.many = [new ManyObjects, new ManyObjects]
        object1.many[0].property1 = 'b'
        object1.many[0].object2 = new Object2
        object1.many[0].object2.id = 'x'
        object1.many[0].object2.property1 = 'c'
        object1.many[1].property1 = 'd'

        await create(schema, 'table1', 'postgres', pgQueryFn, object1)

        let criteria = { many: { object2: {} }}

        let instances = await read(schema, 'table1', 'postgres', pgQueryFn, criteria)

        expect(instances.length).to.equal(2)
        expect(instances[0]).to.deep.equal({
          id: 1,
          property1: 'a',
          property2: 1,
          many: [
            {
              object1Id: 1,
              object2Id: 'x',
              property1: 'b',
              object1Id2: null,
              object2: {
                id: 'x',
                property1: 'c'
              }
            },
            {
              object1Id: 1,
              object2Id: null,
              property1: 'd',
              object1Id2: null
            }
          ]
        })
      })
    })

    describe('update', function() {
      it('should update a simple row without relationships', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 = 1

        await create(schema, 'table1', 'postgres', pgQueryFn, object1)

        let updateObject1 = new Object1
        updateObject1.id = 1
        updateObject1.property1 = 'b'
        updateObject1.property2 = 2

        let updatedInstance = await update(schema, 'table1', 'postgres', pgQueryFn, updateObject1)

        expect(updatedInstance.id).to.equal(1)
        expect(updatedInstance.property1).to.equal('b')
        expect(updatedInstance.property2).to.equal(2)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('b')
        expect(table1Rows[0].column2).to.equal(2)
      })

      it('should not update if the id is missing', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 = 1

        await create(schema, 'table1', 'postgres', pgQueryFn, object1)

        let updateObject1 = new Object1
        updateObject1.property1 = 'b'
        updateObject1.property2 = 2

        expect(update(schema, 'table1', 'postgres', pgQueryFn, updateObject1)).to.be.rejectedWith(Error)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('a')
        expect(table1Rows[0].column2).to.equal(1)
      })

      it('should not update if there was no valid column to set', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 = 1

        await create(schema, 'table1', 'postgres', pgQueryFn, object1)

        let updateObject1 = new Object1
        updateObject1.id = 1
        ;(updateObject1 as any).invalidColumn = 'error'

        let updatedInstance = await update(schema, 'table1', 'postgres', pgQueryFn, updateObject1)

        expect(updatedInstance).to.be.not.undefined
        expect(updatedInstance.id).to.equal(1)
        expect(updatedInstance.property1).to.equal('a')
        expect(updatedInstance.property2).to.equal(1)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('a')
        expect(table1Rows[0].column2).to.equal(1)
      })

      it('should update a row with relationships', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 =  1
        object1.many = [new ManyObjects]
        object1.many[0].property1 = 'b'
        object1.many[0].object2 = new Object2
        object1.many[0].object2.id = 'x'
        object1.many[0].object2.property1 = 'c'

        await create(schema, 'table1', 'postgres', pgQueryFn, object1)

        let updateObject1 = new Object1
        updateObject1.id = 1
        updateObject1.property1 = 'b'
        updateObject1.property2 =  2
        updateObject1.many = [new ManyObjects]
        updateObject1.many[0].object1Id = 1
        updateObject1.many[0].object2Id = 'x'
        updateObject1.many[0].property1 = 'c'
        updateObject1.many[0].object2 = new Object2
        updateObject1.many[0].object2.id = 'x'
        updateObject1.many[0].object2.property1 = 'd'

        let updatedInstance = await update(schema, 'table1', 'postgres', pgQueryFn, updateObject1)

        expect(updatedInstance.id).to.equal(1)
        expect(updatedInstance.property1).to.equal('b')
        expect(updatedInstance.property2).to.equal(2)
        expect(updatedInstance.many).to.deep.equal([
          {
            object1Id: 1,
            object2Id: 'x',
            property1: 'c',
            object1Id2: null,
            object2: {
              id: 'x',
              property1: 'd'
            }
          }
        ])

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('b')
        expect(table1Rows[0].column2).to.equal(2)

        let tableManyRows = await pgQueryFn('SELECT * FROM table_many')

        expect(tableManyRows.length).to.equal(1)
        expect(tableManyRows[0].table1_id).to.equal(1)
        expect(tableManyRows[0].table2_id).to.equal('x')
        expect(tableManyRows[0].column1).to.equal('c')
        expect(tableManyRows[0].table1_id2).to.be.null

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0].id).to.equal('x')
        expect(table2Rows[0].column1).to.equal('d')
      })

      it('should update the same row object only once', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 = 1

        let object4 = new Object4
        object4.object11 = object1
        object4.object12 = object1

        await create(schema, 'table4', 'postgres', pgQueryFn, object4)

        let updateObject1 = new Object1
        updateObject1.id = 1
        updateObject1.property1 = 'b'
        updateObject1.property2 = 2

        let updateObject4 = new Object4
        updateObject4.object1Id1 = 1
        updateObject4.object1Id2 = 1
        updateObject4.object11 = updateObject1
        updateObject4.object12 = updateObject1

        let updatedInstance = await update(schema, 'table4', 'postgres', pgQueryFn, updateObject4)

        expect(updatedInstance).to.be.not.undefined
        expect(updatedInstance.object1Id1).to.equal(1)
        expect(updatedInstance.object1Id2).to.equal(1)
        expect(updatedInstance.object11).to.deep.equal({
          id: 1,
          property1: 'b',
          property2: 2
        })
        expect(updatedInstance.object12).to.deep.equal({
          id: 1,
          property1: 'b',
          property2: 2
        })
        expect(updatedInstance.object11 === updatedInstance.object12).to.be.true

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(1)
        expect(table1Rows[0].column1).to.equal('b')
        expect(table1Rows[0].column2).to.equal(2)

        let table2Rows = await pgQueryFn('SELECT * FROM table4')

        expect(table2Rows.length).to.equal(1)
        expect(table2Rows[0].table1_id1).to.equal(1)
        expect(table2Rows[0].table1_id2).to.equal(1)
      })
    })

    describe('delete_', function() {
      it('should delete a simple instance by id', async function() {
        await create(schema, 'table1', 'postgres', pgQueryFn, { property1: 'a', property2: 1 })
        await create(schema, 'table1', 'postgres', pgQueryFn, { property1: 'b', property2: 2 })

        let deletedInstances = await delete_(schema, 'table1', 'postgres', pgQueryFn, { id: 1 })

        expect(deletedInstances).to.deep.equal({ id: 1, property1: 'a', property2: 1 })

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows).to.deep.equal([{
          id: 2,
          column1: 'b',
          column2: 2
        }])
      })

      it('should not delete anything if id\'s are missing', async function() {
        await create(schema, 'table1', 'postgres', pgQueryFn, { property1: 'a', property2: 1 })
        await create(schema, 'table1', 'postgres', pgQueryFn, { property1: 'b', property2: 2 })

        expect(delete_(schema, 'table1', 'postgres', pgQueryFn, { property1: 'a' })).to.be.rejectedWith(Error)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(2)
        expect(table1Rows).to.deep.equal([
          {
            id: 1,
            column1: 'a',
            column2: 1
          },
          {
            id: 2,
            column1: 'b',
            column2: 2
          }
        ])
      })

      it('should not delete anything if the criteria contained invalid columns', async function() {
        await create(schema, 'table1', 'postgres', pgQueryFn, { property1: 'a', property2: 1 })
        await create(schema, 'table1', 'postgres', pgQueryFn, { property1: 'b', property2: 2 })

        expect(delete_(schema, 'table1', 'postgres', pgQueryFn, { invalid: 'invalid' })).to.be.rejectedWith(Error)

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(2)
        expect(table1Rows).to.deep.equal([
          {
            id: 1,
            column1: 'a',
            column2: 1
          },
          {
            id: 2,
            column1: 'b',
            column2: 2
          }
        ])
      })

      it('should delete its one-to-many relationships', async function() {
        let object1 = new Object1
        object1.property1 = 'a'
        object1.property2 =  1
        object1.many = [new ManyObjects]
        object1.many[0].property1 = 'b'
        object1.many[0].object2 = new Object2
        object1.many[0].object2.id = 'x'
        object1.many[0].object2.property1 = 'c'

        let object2 = new Object1
        object2.property1 = 'b'
        object2.property2 =  2
        object2.many = [new ManyObjects]
        object2.many[0].property1 = 'c'
        object2.many[0].object2 = new Object2
        object2.many[0].object2.id = 'y'
        object2.many[0].object2.property1 = 'd'

        await create(schema, 'table1', 'postgres', pgQueryFn, object1)
        await create(schema, 'table1', 'postgres', pgQueryFn, object2)

        let deletedInstance = await delete_(schema, 'table1', 'postgres', pgQueryFn, { id: 1 })

        expect(deletedInstance).to.be.not.undefined
        expect(deletedInstance).to.deep.equal({
          id: 1,
          property1: 'a',
          property2: 1,
          many: [
            {
              object1Id: 1,
              object2Id: 'x',
              property1: 'b',
              object1Id2: null
            }
          ]
        })

        let table1Rows = await pgQueryFn('SELECT * FROM table1')

        expect(table1Rows.length).to.equal(1)
        expect(table1Rows[0].id).to.equal(2)
        expect(table1Rows[0].column1).to.equal('b')
        expect(table1Rows[0].column2).to.equal(2)

        let tableManyRows = await pgQueryFn('SELECT * FROM table_many')

        expect(tableManyRows.length).to.equal(1)
        expect(tableManyRows[0].table1_id).to.equal(2)
        expect(tableManyRows[0].table2_id).to.equal('y')
        expect(tableManyRows[0].column1).to.equal('c')
        expect(tableManyRows[0].table1_id2).to.be.null

        let table2Rows = await pgQueryFn('SELECT * FROM table2')

        expect(table2Rows.length).to.equal(2)
        expect(table2Rows[0].id).to.equal('x')
        expect(table2Rows[0].column1).to.equal('c')
        expect(table2Rows[1].id).to.equal('y')
        expect(table2Rows[1].column1).to.equal('d')
      })

      it('should delete its one-to-one relationship', async function() {
        let object31 = new Object3
        object31.property1 = 'a'
        object31.object3 = new Object3
        object31.object3.property1 = 'b'
        object31.object3.object3 = object31

        let object32 = new Object3
        object32.property1 = 'c'
        object32.object3 = new Object3
        object32.object3.property1 = 'd'
        object32.object3.object3 = object32

        await create(schema, 'table3', 'postgres', pgQueryFn, object31)
        await create(schema, 'table3', 'postgres', pgQueryFn, object32)

        let deletedInstance = await delete_(schema, 'table3', 'postgres', pgQueryFn, { id: 2 })

        expect(deletedInstance).to.be.not.undefined
        expect(deletedInstance).to.deep.equal({
          id: 2,
          property1: 'a',
          object3Id: 1,
          object3: {
            id: 1,
            property1: 'b',
            object3Id: 2
          }
        })

        let table3Rows = await pgQueryFn('SELECT * FROM table3')

        expect(table3Rows.length).to.equal(2)
        expect(table3Rows[0].id).to.equal(4)
        expect(table3Rows[0].column1).to.equal('c')
        expect(table3Rows[1].id).to.equal(3)
        expect(table3Rows[1].column1).to.equal('d')
      })
    })
  })
})

async function pgQueryFn(sqlString: string, values?: any[]): Promise<any[]> {
  let result = await pool.query(sqlString, values)
  return result.rows
}