import 'mocha'
import { createPool, PoolOptions } from 'mysql2'
import { loadTests } from './load'
import { remainingTests } from './remaining'
import { storeInstanceTests } from './storeInstance'
import { storeRowTests } from './storeRow'

let pool = createPool({
  host: 'mysql8',
  database: 'orm',
  user: 'orm',
  password: 'orm'
} as PoolOptions)

function queryFn(sqlString: string, values?: any[]): Promise<any> {
  return new Promise((resolve, reject) => pool.query(sqlString, values, (err, results) => {
    if (err) {
      reject(err)
    }

    resolve(results)
  }))
}

describe('Orm (MySQL 8 / mysql2)', function() {
  after(async function() {
    await new Promise<void>((resolve, reject) => pool.end(err => {
      if (err) {
        reject(err)
      }

      resolve()
    }))
  })

  beforeEach(async function() {
    await queryFn('CREATE TABLE table1 (id INT AUTO_INCREMENT PRIMARY KEY, column1 VARCHAR(20), column2 INT, column3 TIMESTAMP NULL DEFAULT NULL, many_to_one_object1_id INT, many_to_one_object2_id VARCHAR(20), one_to_one_object1_id INT, one_to_one_object2_id VARCHAR(20), one_to_many_object1_many_to_one_id INT)')
    await queryFn('CREATE TABLE table2 (id VARCHAR(20), column1 VARCHAR(20), column2 INT, column3 TIMESTAMP NULL DEFAULT NULL, one_to_one_object1_id INT, one_to_many_object2_many_to_one_id INT)')
    await queryFn('CREATE TABLE many_to_many_table1 (table1_id1 INT, table1_id2 INT, column1 VARCHAR(20), column2 INT, column3 TIMESTAMP NULL DEFAULT NULL)')
    await queryFn('CREATE TABLE many_to_many_table2 (table1_id INT, table2_id VARCHAR(20), column1 VARCHAR(20), column2 INT, column3 TIMESTAMP NULL DEFAULT NULL)')
  })

  afterEach(async function() {
    await queryFn('DROP TABLE IF EXISTS table1 CASCADE')
    await queryFn('DROP TABLE IF EXISTS table2 CASCADE')
    await queryFn('DROP TABLE IF EXISTS many_to_many_table1 CASCADE')
    await queryFn('DROP TABLE IF EXISTS many_to_many_table2 CASCADE')
  })

  // storeRowTests('mysql', queryFn)
  // storeInstanceTests('mysql', queryFn)
  // loadTests('mysql', queryFn)
  // remainingTests('mysql', queryFn)
})
