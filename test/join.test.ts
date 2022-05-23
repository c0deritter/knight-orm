import { expect } from 'chai'
import 'mocha'
import { JoinAlias } from '../src/join'
import { schema } from './testSchema'

describe('join', function() {
  describe('JoinAlias', function () {
    describe('unjoinRows', function() {
      it('should unjoin simple rows', function() {
        let rows = [
          {
            table1__id: 1,
            table1__column1: 'b',
            table1__column2: 2
          },
          {
            table1__id: 2,
            table1__column1: 'c',
            table1__column2: 3
          }
        ]
  
        let criteria = {}
        let joinAlias = new JoinAlias(schema.getTable('table1'))
        let instances = joinAlias.unjoinRows(rows, criteria)
  
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
            table1__id: 1,
            table1__somethingElse: '?'
          }
        ]
  
        let criteria = {}
        let joinAlias = new JoinAlias(schema.getTable('table1'))
        let instances = joinAlias.unjoinRows(rows, criteria)
  
        expect(instances.length).to.equal(1)
        expect(instances[0]).to.deep.equal({
          id: 1
        })
      })
  
      it('should not regard rows if every of column is NULL', function() {
        let rows = [
          {
            table1__id: null,
            table1__column1: null,
            table1__column2: null
          }
        ]
  
        let criteria = {}
        let joinAlias = new JoinAlias(schema.getTable('table1'))
        let instances = joinAlias.unjoinRows(rows, criteria)
  
        expect(instances.length).to.equal(0)
      })
  
      it('should unjoin a many-to-one relationship', function() {
        let rows = [
          {
            table1__id: 1,
            table1__many_to_one_object1_id: 2,
            table1__manyToOneObject1__id: 2,
            table1__manyToOneObject1__column1: 'b',
            table1__manyToOneObject1__column2: 2,
            table1__manyToOneObject1__column3: null,
          },
          {
            table1__id: 3,
            table1__many_to_one_object1_id: 4,
            table1__manyToOneObject1__id: 4,
            table1__manyToOneObject1__column1: 'c',
            table1__manyToOneObject1__column2: 3,
            table1__manyToOneObject1__column3: null,
          }
        ]
  
        let criteria = { manyToOneObject1: { '@load': true }}
        let joinAlias = new JoinAlias(schema.getTable('table1'))
        let unjoinedRows = joinAlias.unjoinRows(rows, criteria)
  
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
            table1__id: 1,
            table1__many_to_one_object1_id: null,
            table1__manyToOneObject1__id: null,
            table1__manyToOneObject1__column1: null,
            table1__manyToOneObject1__column2: null,
            table1__manyToOneObject1__column3: null,
          }
        ]
  
        let criteria = { manyToOneObject1: { '@load': true }}
        let joinAlias = new JoinAlias(schema.getTable('table1'))
        let unjoinedRows = joinAlias.unjoinRows(rows, criteria)
  
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
            table1__id: 1,
            table1__oneToManyObject1__id: 2,
            table1__oneToManyObject1__column1: 'b',
            table1__oneToManyObject1__column2: 2,
            table1__oneToManyObject1__column3: null,
            table1__oneToManyObject1__one_to_many_object1_many_to_one_id: 1,
          },
          {
            table1__id: 1,
            table1__oneToManyObject1__id: 3,
            table1__oneToManyObject1__column1: 'c',
            table1__oneToManyObject1__column2: 3,
            table1__oneToManyObject1__column3: null,
            table1__oneToManyObject1__one_to_many_object1_many_to_one_id: 1,
          },
          {
            table1__id: 4,
            table1__oneToManyObject1__id: 5,
            table1__oneToManyObject1__column1: 'd',
            table1__oneToManyObject1__column2: 4,
            table1__oneToManyObject1__column3: null,
            table1__oneToManyObject1__one_to_many_object1_many_to_one_id: 4,
          }
        ]
  
        let criteria = { oneToManyObject1: { '@load': true }}
        let joinAlias = new JoinAlias(schema.getTable('table1'))
        let instances = joinAlias.unjoinRows(rows, criteria)
  
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
            table1__id: 1,
            table1__oneToManyObject1__id: null,
            table1__oneToManyObject1__column1: null,
            table1__oneToManyObject1__column2: null,
            table1__oneToManyObject1__column3: null,
            table1__oneToManyObject1__one_to_many_object1_many_to_one_id: null,
          }
        ]
  
        let criteria = { oneToManyObject1: { '@load': true }}
        let joinAlias = new JoinAlias(schema.getTable('table1'))
        let instances = joinAlias.unjoinRows(rows, criteria)
  
        expect(instances.length).to.equal(1)

        expect(instances[0]).to.deep.equal({
          id: 1,
          oneToManyObject1: []
        })
      })
    })  
  })
})
