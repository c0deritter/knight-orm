import { expect } from 'chai'
import 'mocha'
import { getPrimaryKey, getPropertyName, isPrimaryKeyColumn } from '../src/Schema'
import { schema } from './testSchema'

describe('Schema', function() {
  describe('getPrimaryKey', function() {
    it('should return all id columns', function() {
      expect(getPrimaryKey(schema['table1'])).to.deep.equal(['id'])
      expect(getPrimaryKey(schema['many_to_many'])).to.deep.equal(['table1_id', 'table2_id'])
    })
  })

  describe('isPrimaryKeyColumn', function() {
    it('should return false if the column schema is of type string', function() {
      expect(isPrimaryKeyColumn(schema['table1'], 'column1')).to.be.false
    })
  
    it('should return true if the column schema is of type object and the id property set to true', function() {
      expect(isPrimaryKeyColumn(schema['table1'], 'id')).to.be.true
    })
  })

  describe('getPropertyName', function() {
    it('should return the string which in this case is the property', function() {
      expect(getPropertyName(schema.table1, 'column1')).to.equal('property1')
    })

    it('should return the property from the column schema object', function() {
      expect(getPropertyName(schema.table1, 'id')).to.equal('id')
    })
  })
})
