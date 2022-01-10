import { createPool, PoolConfig } from 'mariadb'
import 'mocha'
import { isUpdateTests } from './isUpdate'

let pool = createPool({
  host: 'mariadb10',
  database: 'orm',
  user: 'orm',
  password: 'orm'
} as PoolConfig)

function queryFn(sqlString: string, values?: any[]): Promise<any> {
  return pool.query(sqlString, values)
}

describe('ObjectTools (MariaDb 10)', function() {
  after(async function() {
    await pool.end()
  })

  beforeEach(async function() {
    await pool.query('CREATE TABLE table1 (id INT AUTO_INCREMENT PRIMARY KEY, column1 VARCHAR(20), column2 INT, column3 TIMESTAMP NULL DEFAULT NULL, many_to_one_object1_id INT, many_to_one_object2_id VARCHAR(20), one_to_one_object1_id INT, one_to_one_object2_id VARCHAR(20), one_to_many_object1_many_to_one_id INT)')
    await pool.query('CREATE TABLE table2 (id VARCHAR(20), column1 VARCHAR(20), column2 INT, column3 TIMESTAMP NULL DEFAULT NULL, one_to_one_object1_id INT, one_to_many_object2_many_to_one_id INT)')
    await pool.query('CREATE TABLE many_to_many_table1 (table1_id1 INT, table1_id2 INT, column1 VARCHAR(20), column2 INT, column3 TIMESTAMP NULL DEFAULT NULL)')
    await pool.query('CREATE TABLE many_to_many_table2 (table1_id INT, table2_id VARCHAR(20), column1 VARCHAR(20), column2 INT, column3 TIMESTAMP NULL DEFAULT NULL)')
  })

  afterEach(async function() {
    await pool.query('DROP TABLE IF EXISTS table1 CASCADE')
    await pool.query('DROP TABLE IF EXISTS table2 CASCADE')
    await pool.query('DROP TABLE IF EXISTS many_to_many_table1 CASCADE')
    await pool.query('DROP TABLE IF EXISTS many_to_many_table2 CASCADE')
  })

  isUpdateTests('mariadb', queryFn)
})
