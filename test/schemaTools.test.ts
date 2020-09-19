import { expect } from 'chai'
import 'mocha'
import { getPropertyName, getRelationships, isId } from '../src/Schema'

describe('criteriaTools', function() {
  describe('isId', function() {
    it('should return false if the column schema is of type string', function() {
      expect(isId('a')).to.be.false
    })
  
    it('should return false if the column schema is of type object but with id property set to false', function() {
      expect(isId({ property: 'a', id: false })).to.be.false
    })
  
    it('should return true if the column schema is of type object and the id property set to true', function() {
      expect(isId({ property: 'a', id: true })).to.be.true
    })
  })

  describe('getPropertyName', function() {
    it('should return the string which in this case is the property', function() {
      expect(getPropertyName('a')).to.equal('a')
    })

    it('should return the property from the column schema object', function() {
      expect(getPropertyName({ property: 'a', id: false })).to.equal('a')
    })
  })

  describe('getRelationships', function() {
    it('should return an object containing only the relationships', function() {
      expect(getRelationships({
        name: 'table',
        columns: { 'id': 'id' },
        instanceToRow: (instance) => {},
        rowToInstance: (row) => {},
        relationship1: {
          oneToMany: true,
          property: 'relation1',
          thisId: 'id',
          otherTable: 'other_table',
          otherId: 'other_id'
        },
        relationship2: {
          manyToOne: true,
          property: 'relation2',
          thisId: 'id',
          otherTable: 'other_table',
          otherId: 'other_id'
        },
        otherFunction: () => {}
      })).to.deep.equal({
        relationship1: {
          oneToMany: true,
          property: 'relation1',
          thisId: 'id',
          otherTable: 'other_table',
          otherId: 'other_id'
        },
        relationship2: {
          manyToOne: true,
          property: 'relation2',
          thisId: 'id',
          otherTable: 'other_table',
          otherId: 'other_id'
        }
      })  
    })
  })
})
