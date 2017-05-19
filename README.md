LokiJS Collections
==============

Strongly typed TypeScript collection wrappers for [lokiJS](https://github.com/techfort/LokiJS). 

Creating a database instance is the most involved task, once the database instance is created the rest is fairly straightfoward. 
You'll need a few things to create a lokijs collection database:
* A database name
* Data models - one for each collection with schema information about the type of data being stored in each
* A database persister (you can use the dummy in the 'test/' directory if you don't need to persist your data yet)

```ts
var InMemDbImpl = require(".../lokijs-collections/db-collections/InMemDbImpl");
var DummyDataPersister = require(".../lokijs-collections/test/DummyDataPersister");
var DtoPropertyConverter = require(".../ts-code-generator/code-types/DtoPropertyConverter");
var databaseName = "...";
var dataModels = {
    collection_1_name: {
        properties: DtoPropertyConverter.parseAndConvertTemplateMap({
            "id": { primaryKey: true, autoGenerate: true, type: "number" },
            "name": { type: "string" },
            "props": { type: "string[]" },
        })
    },
	collection_2_name: {
        properties: DtoPropertyConverter.parseAndConvertTemplateMap({
            "userId": { type: "string" },
            "note": { type: "string" },
            "timestamp": { autoGenerate: true, type: "Date" },
        })
    }
};

var dbInst = new InMemDbImpl(databaseName,
    { readAllow: true, writeAllow: true },
    { compressLocalStores: false },
    "for-in-if",
    "collection_meta_data",
    ModelDefinitionsSet.fromCollectionModels(dataModels, null/*defaultDataTypes*/),
    function createPersister(dbInst) {
        var persister = new DummyDataPersister(() => dbInst.getCollections(), InMemDbImpl.cloneForInIf, null);
        return persister;
    });
```

You now have a working in-memory database using lokijs and TypeScript.
Checkout the 'test/' directory for some examples of how to use it.


A few notes about the source directories.

### db-collections/
Contains 'DataCollection', a wrapper for a loki.js collection, add/remove/update functions modify the underlying loki.js collection. 
Also contains 'InMemDbImpl' which bridges the gap between an untyped loki.js instance and 'DataCollection'. 

### data-models/
ModelDefinitionsSet for creating and managing a group of DataCollectionModels using DtoModels or DataCollectionModels as a starting point.

### change-trackers/
Collections and handlers for tracking lokijs collection changes (i.e. updates, additions, deletions). 

### key-constraints/
Collection meta-data and unique/primary key constraint handlers for 'DataCollection'. 
Includes:
- `PrimaryKeyMaintainer` for checking uniqueness of primary keys and/or generating numerical keys (i.e. 1, 2, 3, ...), 
- `NonNullKeyMaintainer` for checking that fields have values
