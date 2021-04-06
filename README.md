# Knight ORM by Coderitter

A library-style ORM.

## Related packages

This packages uses [knight-criteria](https://github.com/c0deritter/knight-criteria) for its query interface and in the background [knight-sql](https://github.com/c0deritter/knight-sql) for representing SQL strings and [knight-sql-criteria-filler](https://github.com/c0deritter/knight-sql-criteria-filler) to translate criteria into SQL queries.

For PostgreSQL databases there is also a package for migrations [knight-pg-migration](https://github.com/c0deritter/knight-pg-migration) and a package for transaction handling [knight-pg-transaction](https://github.com/c0deritter/knight-pg-transaction).

There is also an in-memory object database [knight-object-db](https://github.com/c0deritter/knight-object-db) if you are looking for something which can be used in a browser.

## Install

`npm install knight-orm`

## Overview

The library offers a row centric access to a database with its ISUD (insert, select, update, delete) functions and an object centric access to the database with its CRUD (create, read, update, delete) functions.

### Define your domain objects

At first you will need domain objects.

```typescript
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
```

### Create the tables

Secondly you create database tables for your objects. The example is based on a PostgreSQL database.

```sql
CREATE TABLE knight (id SERIAL, name VARCHAR(100), best_friend_id INTEGER);
CREATE TABLE friends (befriender_id INTEGER, friend_id INTEGER);
CREATE TABLE address (knight_id INTEGER, street VARCHAR(100));
```

### Define a schema

The schema maps tables to objects. It has to be defined for both the ISUD and CRUD functions.

```typescript
let schema = {
    // the keys in the root schema object are names of tables (be aware of casing!)
    'knight': {
        columns: {
            // here are the simple mappings from column to property
            // the keys are column names
            // the values are property names

            // here we denote an id column which are used to uniquely identify an entity in a table
            // for example when updating or deleting the id columns are used in the where clause
            'id': { property: 'id', id: true },

            // these are simple mappings from column to property
            'name': 'name',
            'best_friend_id': 'bestFriendId'
        },

        relationships: {
            // here a many-to-one, one-to-many, one-to-one mappings
            // the keys are property names on the object

            // many-to-one
            'bestFriend': {
                manyToOne: true,
                thisId: 'best_friend_id',
                otherTable: 'knight',
                otherId: 'id'
            },

            // one-to-many
            'knightsWhoThinkIAmTheirBestFriend': {
                oneToMany: true,
                thisId: 'id',
                otherTable: 'knight',
                otherId: 'best_friend_id'
            },

            // many-to-many which basically is a one-to-many to an association table
            // every friends row will be deleted when the owner knight row is deleted
            'friends': {
                oneToMany: true,
                thisId: 'id',
                otherTable: 'friends',
                otherId: 'befriender_id',
                delete: true
            },

            // one-to-one
            // the relationship is denoted by the 'otherRelationship' key
            // it tells the system that this relationship needs to refer back
            // the address row will be deleted when the owner knight row is deleted
            'address': {
                manyToOne: true,
                thisId: 'id',
                otherTable: 'address',
                otherId: 'knight_id',
                otherRelationship: 'knight',
                delete: true
            }
        },

        // a function to convert a row into an instance
        rowToInstance: (row: any) => {
            let knight = new Knight
            
            knight.id = row['id']
            knight.name = row['name']
            knight.bestFriendId = row['best_friend_id']

            return knight
        },

        // a function to convert an instance into a row
        instanceToRow: (knight: Knight) => {
            return {
                id: knight.id,
                name: knight.name,
                best_friend_id: knight.bestFriendId
            }
        }
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

        rowToInstance: (row: any) => { ... },
        instanceToRow: (friends: Friends) => { ... }
    },

    // this is the one-to-one table
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

        rowToInstance: (row: any) => { ... },
        instanceToRow: (address: Address) => { ... }
    }
}
```

### The query function

The query function is a parameter of all ISUD and CRUD functions. It resembles a query to your database system which returns an array of row objects. It is the compatibility layer to be able to adopt to any database system.

```typescript
let queryFn = async function(sqlString: string, values?: any[]): Promise<any[]> {
    // use the PostgreSQL pool for example
    let result = await pool.query(sqlString, values)

    // return the array of row objects only
    return result.rows
}
```

### ISUD - Insert, Select, Update, Create

The ISUD functions offer a row centric access to the database. That means that in your parameters you work with actual database columns. The CRUD functions in contrast let you work with your actual domain objects using their properties. In fact, the CRUD functions are based on the ISUD functions, adding conversions for domain object property names to database table names.

#### insert()

Insert a database row.

```typescript
import { insert } from 'knight-orm'

let row = {
    name: 'Luisa'
}

let inserted = await insert(schema, 'knight', 'postgres', queryFn, row)

inserted == {
    id: 1,
    name: 'Luisa',
    best_friend_id: null
}
```

The best thing about this function is that you can also populate the relationships which will be automatically stored into the right tables.

```typescript
import { insert } from 'knight-orm'

let row = {
    name: 'Luisa',
    bestFriend: {
        name: 'Fatlinda'
    },
    address: {
        street: 'Great Garden Street'
    }
}

let inserted = await insert(schema, 'knight', 'postgres', queryFn, row)

inserted == {
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
}
```

You can even achieve the same result while inserting the address instead of the knight.

```typescript
import { insert } from 'knight-orm'

let row = {
    street: 'Great Garden Street',
    knight: {
        name: 'Luisa',
        bestFriend: {
            name: 'Fatlinda'
        }
    }
}

let inserted = await insert(schema, 'address', 'postgres', queryFn, row)

inserted == {
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
}
```

The rule here is, if it should work it will work.

#### select()

The interface for selecting is realized through ReadCriteria from [knight-criteria](https://github.com/c0deritter/knight-criteria).

A simple query looks like this.

```typescript
import { select } from 'knight-orm'

// looks for rows where the id equals 1
var criteria = {
    id: 1
}

let selected = await select(schema, 'knight', 'postgres', queryFn, criteria)

selected == [
    {
        id: 1,
        name: 'Luisa',
        best_friend_id: 2
    }
]
```

You can also state criteria for the relationships which will cause the rows of that particular relationship to be filtered. A new query for every given relationship criteria is executed.

```typescript
import { select } from 'knight-orm'

// loads every knight with all its knights who think that the knight is their best friend whose name start with L
var criteria = {
    knightsWhoThinkIAmTheirBestFriend: {
        name: {
            operator: 'ILIKE',
            value: 'L%'
        }
    }
}

let selected = await select(schema, 'knight', 'postgres', queryFn, criteria)

selected == [
    {
        id: 1,
        name: 'Luisa',
        best_friend_id: 2,
        knightsWhoThinkIAmTheirBestFriend: []
    },
    {
        id: 2,
        name: 'Fatlinda',
        best_friend_id: 1,
        knightsWhoThinkIAmTheirBestFriend: {
            id: 1,
            name: 'Luisa',
            best_friend_id: 2
        }
    }
]
```

If you want only those rows which have relationship rows that match certain criteria you can use the `@filterGlobally' key. In that case the tables will be joined instead of starting a new query.

```typescript
import { select } from 'knight-orm'

// loads only those knights with all its knights who think that the knight is their best friend whose name start with L
var criteria = {
    knightsWhoThinkIAmTheirBestFriend: {
        '@filterGlobally': true,
        name: {
            operator: 'ILIKE',
            value: 'L%'
        }
    }
}

let selected = await select(schema, 'knight', 'postgres', queryFn, criteria)

selected == [
    // knight Luisa is missing...
    {
        id: 2,
        name: 'Fatlinda',
        best_friend_id: 1,
        knightsWhoThinkIAmTheirBestFriend: {
            id: 1,
            name: 'Luisa',
            best_friend_id: 2
        }
    }
]
```

#### isud_update()

The interface for updating is realized through UpdateCriteria from [knight-criteria](https://github.com/c0deritter/knight-criteria).

A simple update.

```typescript
import { isud_update as update } from 'knight-orm'

let row = {
    id: 1,
    '@set': {
        best_friend_id: 3
    }
}

let updated = await update(schema, 'knight', 'postgres', queryFn, row)

updated == {
    id: 1,
    name: 'Luisa',
    best_friend_id: 3
}
```

#### isud_delete()

The interface for deleting is realized through DeleteCriteria from [knight-criteria](https://github.com/c0deritter/knight-criteria).

A simple delete example.

```typescript
import { isud_delete as delete_ } from 'knight-orm'

let row = {
    id: 2
}

let deleted = await delete_(schema, 'knight', 'postgres', queryFn, row)

deleted == {
    id: 2,
    name: 'Fatlinda',
    best_friend_id: null,
}
```

It will also delete relationships if denoted in the schema.

```typescript
import { isud_delete as delete_ } from 'knight-orm'

let row = {
    id: 1
}

let deleted = await delete_(schema, 'knight', 'postgres', queryFn, row)

deleted == {
    id: 1,
    name: 'Luisa',
    best_friend_id: 2,
    address: {
        knight_id: 1,
        street: 'Great Garden Street'
    }
}
```

### CRUD - Create, Read, Update, Delete

The CRUD functions offer an object centric access to the database. That means that in your parameters you work with actual domain objects instead with database rows. The CRUD functions use the ISUD functions. Basically they add object-to-row and row-to-object logic around it. In the case of `update` and `delete` they also limit the processing of only one object instead of arbitrary many rows in its ISUD counterparts.

#### create()

Creating works exactly like `insert()` but you will use your domain objects instead of row objects and the result will also be a domain object instead of a row.

```typescript
import { create } from 'knight-orm'

let luisa = new Knight
luisa.name = 'Luisa'

let created = await create(schema, 'knight', 'postgres', queryFn, luisa)

// the return value is an instance of the Knight class
created == {
    id: 1,
    name: 'Luisa',
    best_friend_id: null
}
```

#### read()

Reading works exactly like `select()` but you will use your domain objects instead of row objects and the result consists also be domain objects instead of rows.

```typescript
import { read } from 'knight-orm'

// looks for rows where the id equals 1
var criteria = {
    id: 1
}

let read = await read(schema, 'knight', 'postgres', queryFn, criteria)

// every result in the array is an instance of the Knight class
read == [
    {
        id: 1,
        name: 'Luisa',
        best_friend_id: 2
    }
]
```

#### update()

Updating works like `isud_update()` with the difference that you can only update one row at once instead of being able to update as many rows as you like. Also CRUD `update()` supports updating of relationships.

```typescript
import { update } from 'knight-orm'

let luisa = new Knight
luisa.id = 1
luisa.bestFriendId = 3
// undefined properties will not be updated

let updated = await update(schema, 'knight', 'postgres', queryFn, luisa)

// the return value is an instance of the Knight class
updated == {
    id: 1,
    name: 'Luisa',
    bestFriendId: 3
}
```

#### delete()

Updating works like `isud_delete()` with the difference that you can only delete one row at once instead of being able to delete as many rows as you like.

```typescript
import { delete_ } from 'knight-orm'

let luisa = new Knight
luisa.id = 1

let deleted = await delete_(schema, 'knight', 'postgres', queryFn, luisa)

// the return value is an instance of the Knight class
deleted == {
    id: 1,
    name: 'Luisa',
    best_friend_id: 2,
    // address also got deleted because of cascading delete definition in the schema
    address: {
        knightId: 1,
        street: 'Great Garden Street'
    }
}
```
