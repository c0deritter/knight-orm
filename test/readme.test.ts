import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import 'mocha'
import { Pool, PoolConfig } from 'pg'
import { Schema } from '../src'
import { store } from '../src/isud'

chai.use(chaiAsPromised)
const expect = chai.expect

let pool: Pool = new Pool({
  host: 'postgres',
  database: 'sqlorm_test',
  user: 'sqlorm_test',
  password: 'sqlorm_test'
} as PoolConfig)

describe('README.md', function () {
  describe('PostgreSQL', function () {
    after(async function () {
      await pool.end()
    })

    beforeEach(async function () {
      await pool.query('CREATE TABLE knight (id SERIAL, name VARCHAR(100), best_friend_id INTEGER)')
      await pool.query('CREATE TABLE friends (befriender_id INTEGER, friend_id INTEGER)')
      await pool.query('CREATE TABLE address (knight_id INTEGER, street VARCHAR(100))')
    })

    afterEach(async function () {
      await pool.query('DROP TABLE IF EXISTS knight CASCADE')
      await pool.query('DROP TABLE IF EXISTS friends CASCADE')
      await pool.query('DROP TABLE IF EXISTS address CASCADE')
    })

    describe('store', function () {
      it('should store a simple row', async function () {
        let row = {
          name: 'Luisa'
        }
      
        let stored = await store(schema, 'knight', 'postgres', pgQueryFn, row)

        expect(stored).to.deep.equal({
          id: 1,
          name: 'Luisa',
          best_friend_id: null
        })
      })

      it('should store a sophisticated row', async function() {
        let row = {
          name: 'Luisa',
          bestFriend: {
              name: 'Fatlinda'
          },
          address: {
              street: 'Great Garden Street'
          }
        }      

        let stored = await store(schema, 'knight', 'postgres', pgQueryFn, row)

        expect(stored).to.deep.equal({
          id: 1,
          name: 'Luisa',
          best_friend_id: 2,
          
          bestFriend: {
            id: 2,
            name: 'Fatlinda',
            best_friend_id: null
          },

          address: {
            knight_id: 1,
            street: 'Great Garden Street'
          }
        })
      })

      it('should store starting from an address row', async function() {
        let row = {
          street: 'Great Garden Street',
          knight: {
            name: 'Luisa',
            bestFriend: {
              name: 'Fatlinda'
            }
          }
        }

        let stored = await store(schema, 'address', 'postgres', pgQueryFn, row)

        expect(stored).to.deep.equal({
          knight_id: 1,
          street: 'Great Garden Street',
          knight: {
            id: 1,
            name: 'Luisa',
            best_friend_id: 2,
            bestFriend: {
              id: 2,
              name: 'Fatlinda',
              best_friend_id: null
            }  
          }
        })
      })
    })
  })
})

async function pgQueryFn(sqlString: string, values?: any[]): Promise<any[]> {
  let result = await pool.query(sqlString, values)
  return result.rows
}

let schema: Schema = {
  'knight': {
    columns: {
      'id': { property: 'id', primaryKey: true, generated: true },
      'name': 'name',
      'best_friend_id': 'bestFriendId'
    },

    relationships: {
      'bestFriend': {
        manyToOne: true,
        thisId: 'best_friend_id',
        otherTable: 'knight',
        otherId: 'id'
      },

      'knightsWhoThinkIAmTheirBestFriend': {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'knight',
        otherId: 'best_friend_id'
      },

      'friends': {
        oneToMany: true,
        thisId: 'id',
        otherTable: 'friends',
        otherId: 'befriender_id'
      },

      'address': {
        manyToOne: true,
        thisId: 'id',
        otherTable: 'address',
        otherId: 'knight_id',
        otherRelationship: 'knight'
      }
    },

    newInstance: () => new Knight
  },

  // this is the many-to-many association table
  'friends': {
    columns: {
      'befriender_id': 'befrienderId',
      'friend_id': 'friendId'
    },
    relationships: {
      'befriender': {
        manyToOne: true,
        thisId: 'befriender_id',
        otherTable: 'knight',
        otherId: 'id'
      },
      'friend': {
        manyToOne: true,
        thisId: 'friend_id',
        otherTable: 'knight',
        otherId: 'id'
      }
    },

    newInstance: () => new Friends
  },

  'address': {
    columns: {
      'knight_id': 'knight_id',
      'street': 'street'
    },
    relationships: {
      'knight': {
        manyToOne: true,
        thisId: 'knight_id',
        otherTable: 'knight',
        otherId: 'id',
        otherRelationship: 'address'
      }
    },

    newInstance: () => new Address
  }
}

class Knight {
  id?: number
  name?: string
  bestFriendId?: number
  
  bestFriend?: Knight
  knightsWhoThinkIAmTheirBestFriend?: Knight[]
  friends?: Friends[]
  address?: Address
}

class Friends {
  befrienderId?: number
  friendId?: number

  befriender?: Knight
  friend?: Knight
}

class Address {
  knightId?: number
  street?: string

  knight?: Knight
}
