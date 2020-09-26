import { expect } from 'chai'
import 'mocha'
import { getIdColumns, getPropertyName, isIdColumn } from '../src/Schema'
import { schema } from './testSchema'

describe('Schema', function() {
  describe('getIdColumns', function() {
    it('should return all id columns', function() {
      expect(getIdColumns(schema['table1'])).to.deep.equal(['id'])
      expect(getIdColumns(schema['table_many'])).to.deep.equal(['table1_id', 'table2_id'])
    })
  })

  describe('isIdColumn', function() {
    it('should return false if the column schema is of type string', function() {
      expect(isIdColumn('a')).to.be.false
    })
  
    it('should return false if the column schema is of type object but with id property set to false', function() {
      expect(isIdColumn({ property: 'a', id: false })).to.be.false
    })
  
    it('should return true if the column schema is of type object and the id property set to true', function() {
      expect(isIdColumn({ property: 'a', id: true })).to.be.true
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
})
