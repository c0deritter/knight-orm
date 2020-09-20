import { expect } from 'chai'
import 'mocha'
import { getPropertyName, isId } from '../src/Schema'

describe('Schema', function() {
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
})
