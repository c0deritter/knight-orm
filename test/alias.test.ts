import { expect } from 'chai'
import 'mocha'
import { Alias } from '../src/alias'
import { schema } from './testSchema'

describe('alias', function() {
  describe('Alias', function () {
    describe('unjoinRows', function() {
      it('should unjoin simple rows', function() {
        let rows = [
          {
            t_0: 1,
            t_1: 'b',
            t_2: 2
          },
          {
            t_0: 2,
            t_1: 'c',
            t_2: 3
          }
        ]
  
        let criteria = {}
        let alias = new Alias(schema.getTable('table1'))
        let instances = alias.unjoinRows(rows, criteria)
  
        expect(instances.length).to.equal(2)
        expect(instances[0]).to.deep.equal({
          id: 1,
          property1: 'a',
          property2: 1
        })
        expect(instances[1]).to.deep.equal({
          id: 2,
          property1: 'b',
          property2: 2
        })
      })
  
      it('should ignore columns which do not exist in the schema', function() {
        let rows = [
          {
            t_0: 1,
            t_999: '?'
          }
        ]
  
        let criteria = {}
        let alias = new Alias(schema.getTable('table1'))
        let instances = alias.unjoinRows(rows, criteria)
  
        expect(instances.length).to.equal(1)
        expect(instances[0]).to.deep.equal({
          id: 1
        })
      })
  
      it('should not regard rows if every of column is NULL', function() {
        let rows = [
          {
            t_0: null,
            t_1: null,
            t_2: null
          }
        ]
  
        let criteria = {}
        let alias = new Alias(schema.getTable('table1'))
        let instances = alias.unjoinRows(rows, criteria)
  
        expect(instances.length).to.equal(0)
      })
  
      it('should unjoin a many-to-one relationship', function() {
        let rows = [
          {
            t_0: 1,
            t_4: 2,
            t__0_0: 2,
            t__0_1: 'b',
            t__0_2: 2,
            t__0_3: null,
          },
          {
            t_0: 3,
            t_4: 4,
            t__0_0: 4,
            t__0_1: 'c',
            t__0_2: 3,
            t__0_3: null,
          }
        ]
  
        let criteria = { manyToOneObject1: { '@load': true }}
        let alias = new Alias(schema.getTable('table1'))
        let unjoinedRows = alias.unjoinRows(rows, criteria)
  
        expect(unjoinedRows.length).to.equal(2)
  
        expect(unjoinedRows[0]).to.deep.equal({
          id: 1,
          manyToOneObject1Id: 2,
          manyToOneObject1: {
            id: 2,
            property1: 'a',
            property2: 1,
            property3: null
          }
        })

        expect(unjoinedRows[1]).to.deep.equal({
          id: 3,
          manyToOneObject1Id: 4,
          manyToOneObject1: {
            id: 4,
            property1: 'b',
            property2: 2,
            property3: null
          }
        })
      })
  
      it('should not unjoin a many-to-one relationship which is not there', function() {
        let rows = [
          {
            t_0: 1,
            t_4: null,
            t__0__0: null,
            t__0__1: null,
            t__0__2: null,
            t__0__3: null,
          }
        ]
  
        let criteria = { manyToOneObject1: { '@load': true }}
        let alias = new Alias(schema.getTable('table1'))
        let unjoinedRows = alias.unjoinRows(rows, criteria)
  
        expect(unjoinedRows.length).to.equal(1)
  
        expect(unjoinedRows[0]).to.deep.equal({
          id: 1,
          manyToOneObject1Id: null,
          manyToOneObject1: null
        })
      })
  
      it('should unjoin a one-to-many relationship', function() {
        let rows = [
          {
            t_0: 1,
            t__4_0: 2,
            t__4_1: 'b',
            t__4_2: 2,
            t__4_3: null,
            t__4_8: 1,
          },
          {
            t_0: 1,
            t__4_0: 3,
            t__4_1: 'c',
            t__4_2: 3,
            t__4_3: null,
            t__4_8: 1,
          },
          {
            t_0: 4,
            t__4_0: 5,
            t__4_1: 'd',
            t__4_2: 4,
            t__4_3: null,
            t__4_8: 4,
          }
        ]
  
        let criteria = { oneToManyObject1: { '@load': true }}
        let alias = new Alias(schema.getTable('table1'))
        let instances = alias.unjoinRows(rows, criteria)
  
        expect(instances.length).to.equal(2)
        expect(instances[0]).to.deep.equal({
          id: 1,
          oneToManyObject1: [
            {
              id: 2,
              property1: 'a',
              property2: 1,
              property3: null,
              oneToManyObject1ManyToOneId: 1
            },
            {
              id: 3,
              property1: 'b',
              property2: 2,
              property3: null,
              oneToManyObject1ManyToOneId: 1
            }
          ]
        })
  
        expect(instances[1]).to.deep.equal({
          id: 4,
          oneToManyObject1: [
            {
              id: 5,
              property1: 'c',
              property2: 3,
              property3: null,
              oneToManyObject1ManyToOneId: 4
            }
          ]
        })
      })

      it('should not unjoin a one-to-many relationship which is not there', function() {
        let rows = [
          {
            t_0: 1,
            t__4__0: null,
            t__4__1: null,
            t__4__2: null,
            t__4__3: null,
            t__4__4: null,
          }
        ]
  
        let criteria = { oneToManyObject1: { '@load': true }}
        let alias = new Alias(schema.getTable('table1'))
        let instances = alias.unjoinRows(rows, criteria)
  
        expect(instances.length).to.equal(1)

        expect(instances[0]).to.deep.equal({
          id: 1,
          oneToManyObject1: []
        })
      })
    })  
  })
})
