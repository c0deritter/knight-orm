import { expect } from 'chai'
import 'mocha'
import { unjoinRows } from '../src/rowTools'
import { ManyObjects, Object1, Object2, schema } from './testSchema'

describe('rowTools', function() {
  describe('unjoinRows', function() {
    it('should create corresponding instance from simple rows without relationships', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__somethingElse: '?'
        },
        {
          table1__id: 2,
          table1__column1: 'b',
          table1__column2: 2,
          table1__somethingElse: '?'
        }
      ]

      let criteria = { a: 'a', b: 1 }
      let instances = unjoinRows(schema, 'table1', rows, criteria, true)

      expect(instances.length).to.equal(2)
      expect(instances[0]).to.be.instanceOf(Object1)
      expect(instances[0]).to.deep.equal({ id: 1, property1: 'a', property2: 1 })
      expect(instances[1]).to.be.instanceOf(Object1)
      expect(instances[1]).to.deep.equal({ id: 2, property1: 'b', property2: 2 })
    })

    it('should create corresponding instance from simple rows with relationships', function() {
      let rows = [
        {
          table1__id: 1,
          table1__column1: 'a',
          table1__column2: 1,
          table1__many__table1_id: 1,
          table1__many__table2_id: 1,
          table1__many__column1: 'b',
          table1__many__table1_id2: null,
          table1__many__object2__id: 1,
          table1__many__object2__column1: 'c'
        },
        {
          table1__id: 2,
          table1__column1: 'd',
          table1__column2: 2,
          table1__many__table1_id: 2,
          table1__many__table2_id: null,
          table1__many__column1: 'e',
          table1__many__table1_id2: null,
          table1__many__object2__id: null,
          table1__many__object2__column1: null
        },
        {
          table1__id: 3,
          table1__column1: 'f',
          table1__column2: 3,
          table1__many__table1_id: null,
          table1__many__table2_id: null,
          table1__many__column1: null,
          table1__many__table1_id2: null,
          table1__many__object2__id: null,
          table1__many__object2__column1: null
        }
      ]

      let criteria = { many: { object2: {} }}

      let instances = unjoinRows(schema, 'table1', rows, criteria, true)

      expect(instances.length).to.equal(3)
      expect(instances[0]).to.be.instanceOf(Object1)
      expect(instances[0].many).to.be.instanceOf(Array)
      expect(instances[0].many[0]).to.be.instanceOf(ManyObjects)
      expect(instances[0].many[0].object2).to.be.instanceOf(Object2)
      expect(instances[0]).to.deep.equal({ id: 1, property1: 'a', property2: 1, many: [{ object1Id: 1, object2Id: 1, property1: 'b', object2: { id: 1, property1: 'c' }}]})
      expect(instances[1]).to.be.instanceOf(Object1)
      expect(instances[1].many).to.be.instanceOf(Array)
      expect(instances[1].many[0]).to.be.instanceOf(ManyObjects)
      expect(instances[1].many[0].object2).to.be.undefined
      expect(instances[1]).to.deep.equal({ id: 2, property1: 'd', property2: 2, many: [{ object1Id: 2, object2Id: null, property1: 'e' }]})
      expect(instances[2]).to.be.instanceOf(Object1)
      expect(instances[2].many).to.be.undefined
      expect(instances[2]).to.deep.equal({ id: 3, property1: 'f', property2: 3 })
    })
  })
})