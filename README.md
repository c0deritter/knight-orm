# Knight ORM by Coderitter

A very leight-weight ORM which takes your object trees and stores them into the database. It also supports [knight-criteria](https://github.com/c0deritter/knight-criteria) for simple yet powerful definition of database queries.

## Dependencies

This package uses [knight-criteria](https://github.com/c0deritter/knight-criteria) for its query interface and in the background [knight-sql](https://github.com/c0deritter/knight-sql) for representing SQL strings.

## Related packages

For PostgreSQL databases there is also a package for migrations [knight-pg-migration](https://github.com/c0deritter/knight-pg-migration) and a package for transaction handling [knight-pg-transaction](https://github.com/c0deritter/knight-pg-transaction).

There is also an in-memory object database [knight-object-db](https://github.com/c0deritter/knight-object-db) if you are looking for something which can be used in a browser.

## Install

`npm install knight-orm`

## Quickstart

Define your domain object.

```typescript
class Knight {
  id: number
  name: string
}
```

Create the database table. The example is based on a PostgreSQL database.

```sql
CREATE TABLE knight (id SERIAL, name VARCHAR(100));
```

Define the schema.

```typescript
import { Schema } from 'knight-orm'

let schema = new Schema

schema.addTable('knight', {
  columns: {
    'id': { property: 'id', primaryKey: true, generated: true },
    'name': 'name'
  },
  newInstance: () => new Knight
})
```

Adopt your database. The example is based on a PostgreSQL database.

```typescript
import { Pool } from 'pg'
let pool = new Pool({ ... })

function queryFn(sqlString: string, values?: any[]): Promise<any> {
  return pool.query(sqlString, values)
}
```

Instantiate the ORM and work with it.

```typescript
let orm = new Orm(schema, 'postgres')
let luisa = new Knight('Luisa')

await orm.store(queryFn, luisa) // INSERT or UPDATE
await orm.load(queryFn, Knight, { name: 'Luisa' })
await orm.count(queryFn, Knight)
await orm.delete(queryFn, luisa)
```

## Overview

The package consists of the following classes.

- `Schema`: Holds the essential information to be able to map entities from the database world to the object world and vice verca.
- `Orm`: It is the heart of this package. It contains the methods to store, delete, load and count entities, but also other useful tools to work with different aspects of the object-relational mapping.

## Defining a schema

The schema tells the ORM how the object world relates to the database world. With it, it can map one to the other and the other way around.

A schema consists of the following pieces. The bold ones are mandatory while the italic ones are optional.

- **Column mapping**: Maps database column names to object property names
- *Relationship definitions*: Maps the relationships between database tables to relationships between objects
- **Instance creating function**: A function that creates an instance of the corresponding class of the object world
- *Row to instance function*: A function that takes a database row and creates an instance out of it
- *Instance to row function*: A function that takes an instance and creates a database row out of it

Adding a schema for one table looks like this.

```typescript
import { Schema } from 'knight-orm'

let schema = new Schema

schema.addTable('knight', {
  columns: {
    'id': { property: 'id', primaryKey: true, generated: true },
    'name': 'name'
  },
  relationships: {},
  newInstance: () => new Knight,
  rowToInstance: (row: any, knight: Knight) => { ... },
  instanceToRow: (knight: Knight, row: any) => { ... }
})
```

The schema class has a method `check` which can be used to find inconstencies within the mapping. It will throw an error with a sophisticated error message which will help you debugging.

```typescript
schema.check()
```

If you do not call this method, the checks will be done when the corresponding definitions are used, which might be far later into the program or even never.

### Mapping columns

Mapping columns is done through an object, which keys are database columns and which values are property names of your domain object.

```typescript
let columns = {
  'database_column': 'propertyName'
}
```

You also need to define a primary key. The `store` method will check, if all primary key columns are set. If they are not, it will throw an error.

```typescript
let columns = {
  'id': {
    property: 'id',
    primaryKey: true
  }
}
```

Most of the database systems offer to generate an incremental id value. If you are using this feature, you need to declare it in the schema.

```typescript
let columns = {
  'id': {
    property: 'id',
    primaryKey: true,
    generated: true
  }
}
```

### Mapping relationships

A relationship is between two database tables. There are the two fundamental types `many-to-one` and `one-to-many`. The other known types `one-to-one` and `many-to-many` are realized through a combination of the former.

A `many-to-one` is mapped to a property which holds a reference to another object. A `one-to-many` is mapped to a property holding an array of object references.

```typescript
let instance = {
  manyToOne: {},
  oneToMany: [{}, {}, {}]
}
```

#### Many-To-One

A `many-to-one` relationship is when a row of table explicitely references a row of another table. Of course, the other table might also be the same table or the other row might also be the same row.

Let us assume, that a knight lives in exactly one castle. You will need an additional column `lives_in_castle_id` in the table `knight` which references a primary key column of the table `castle`.

```sql
CREATE TABLE knight (id SERIAL, name VARCHAR(100), lives_in_castle_id INTEGER);
CREATE TABLE castle (id SERIAL, name VARCHAR(100));
```

To be able to map that column into the object world, you also need an additional property `livesInCastleId` in the class `Knight`. To be able to work with the relationship in the object world, you also need a property `livesInCastle`, which references another instance of class `Castle`.

```typescript
class Knight {
  id: number
  name: string
  
  livesInCastleId: number
  livesInCastle: Castle
}

class Castle {
  id: number
  name: string
}

let knight = new Knight('Luisa')
knight.livesInCastle = new Castle('Kingstone')
```

Now you can create the relationship mapping for the table `knight`. Relationships are defined in an object which keys are the names of the properties holding the referenced instances. In our `many-to-one` example it is the property `livesInCastle` of the class `Knight`. The referenced schema object defines the id `thisId` of this table, which references the id `otherId` of the `otherTable`.

```typescript
import { Schema } from 'knight-orm'

let schema = new Schema

schema.addTable('knight', {
  columns: {
    'id': { property: 'id', primaryKey: true, generated: true },
    'name': 'name',
    'lives_in_castle_id': 'livesInCastleId'
  },
  relationships: {
    'livesInCastle': {
      manyToOne: true,
      thisId: 'lives_in_castle_id',
      otherTable: 'castle',
      otherId: 'id'
    }
  },
  newInstance: () => new Knight
})
```

Now, when you store a knight, the ORM will also store the castle. When you load the knight and you explictely declared it, the ORM will also load the castle into the `livesInCastle` property.

```typescript
orm.store(queryFn, knight)
orm.load(queryFn, Knight, { livesInCastle: { '@load': true }})
```

### One-To-Many

A `one-to-many` relationship is, when the row of one table is explicitely referenced many times by `many-to-one` relationships of rows from another table. This means, that this kind of a relationship is the implicit counterpart of a `many-to-one` relationship. If you define a `many-to-one` relationship, the `one-to-many` relationship is inherently there.

Let us go back to our knight/castle relationship. Now that we know in which castle a knight lives in, we also want to know, which knights live in which castles.

To do this, we do not need to add additional columns to any table, but we add an additional property `knightsLivingHere` to our domain object castle.

```typescript
class Castle {
  id: number
  name: string

  knightsLivingHere: Knight[]
}
```

Here comes the relationship mapping for the table `castle`.

```typescript
import { Schema } from 'knight-orm'

let schema = new Schema

schema.addTable('castle', {
  columns: {
    'id': { property: 'id', primaryKey: true, generated: true },
    'name': 'name'
  },
  relationships: {
    'knightsLivingHere': {
      oneToMany: true,
      thisId: 'id',
      otherTable: 'knight',
      otherId: 'lives_in_castle_id'
    }
  },
  newInstance: () => new Castle
})
```

Now, when you store a castle, the ORM will also store the knights living there. When you load a castle and you explictely declared it, the ORM will also load the knights into the `knightsLivingHere` property.

```typescript
orm.store(queryFn, knight)
orm.load(queryFn, Knight, { knightsLivingHere: { '@load': true }})
```

### Many-To-Many

The `many-to-many` relationship is when 

### One-To-One

## Using the Orm

The Orm is the central class you will be working with after you defined the schema. It consists of the following.

- `store()`: Stores either an instance or database row object into the database along with its attached relationship objects. It automatically determines if to use an SQL `INSERT` or `UPDATE`.
- `delete()`: Deletes either an instance or a database row object from the database. It does not automatically delete attached relationship objects.
- `load()`: Uses [knight-criteria](https://github.com/c0deritter/knight-criteria) to load either instances or database row objects along with their relationship objects from the database.
- `count()`: Uses [knight-criteria](https://github.com/c0deritter/knight-criteria) which either reference instance properties or database columns to count entities.
- `criteriaUpdate()`: Updates a bunch of database rows that match given [knight-criteria](https://github.com/c0deritter/knight-criteria) which either reference instance properties or database columns.
- `criteriaDelete()`: Delete a bunch of database rows that match given [knight-criteria](https://github.com/c0deritter/knight-criteria) which either reference instance properties or database columns.
- `criteriaTools`: An object containing methods to work with [knight-criteria](https://github.com/c0deritter/knight-criteria).
- `objectTools`: An object containing methods to work with either instances or database rows.
- `queryTools`: An object containing methods to work with database queries which are based on [knight-sql](https://github.com/c0deritter/knight-sql).

The methods `store()`, `delete()`, `load()` and `count()` are your main work horses. The methods `criteriaUpdate()` and `criteriaDelete()` might occasionally come in handy. The tools sub objects yield sophisticated functionality which you will be using if you need more adjusted behaviour. 

### Instantiating

After you defined a schema you are ready to instantiate the ORM.

```typescript
import { Orm } from 'knight-orm'

let orm = new Orm(schema, 'postgres')
```

The second parameter denotes the database system which you will be using. At the moment there is support for `postgres`, `mysql` and `maria`.

### The query function

The query function is a parameter for all methods that access the database. It is the tool to adopt your database system to work with this package. The only thing you need to do is to define a function which forwards its parameters to a function which can acutally query your database system.

```typescript
import { Pool } from 'pg'
let pool = new Pool({ ... })

function queryFn(sqlString: string, values?: any[]): Promise<any> {
  return pool.query(sqlString, values)
}
```

The first parameter is the SQL string and the second one the array of values which the connector of your database system will use to replace the parameters in the given SQL string.

This function is the key to be able to wrap the method calls of the ORM inside a database transaction. Just use an explicit connection instead of a pool.

```typescript
let client = await pool.connect()
await client.query('BEGIN')

try {
  await orm.store(knight, (sqlString: string, values?: any[]) => client.query(sqlString, values))
  await client.query('COMMIT')
}
catch (e) {
  await client.query('ROLLBACK')
}
finally {
  client.release()
}
```

To help with transactions, there is the package [knight-pg-transaction](https://github.com/c0deritter/knight-pg-transaction) and [knight-maria-transaction](https://github.com/c0deritter/knight-maria-transaction). You can find more information on how to combine those packages with the ORM further down.

Note that in case of PostgreSQL, the SQL string is extended with a `RETURNING` statement if it is an `INSERT` query. It is needed to retrieve the auto generated primary key column but it will also cause problems if you already declared your own `RETURNING` statement.

### Storing

### Deleting

### Loading

### Counting

### Updating with criteria

### Deleting with criteria

## Combine with knight-transaction