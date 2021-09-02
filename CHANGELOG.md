# Change Log
All notable changes to this project will be documented in this file.
This project does its best to adhere to [Semantic Versioning](http://semver.org/).


--------
### [0.29.1](N/A) - 2021-09-02
#### Added
* `test/CollectionTest` for some much needed [db-collections/Collection.ts](db-collections/Collection.ts) coverage

#### Change
* Update dependency to `@twg2/ts-twg-ast-codegen@0.29.0`
* Remove old unrelated `test/CompileManualBrowserBundleTest` and resulting unused `devDependencies`


--------
### [0.29.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/809c4560357d1b37f886831258da3b4819ee3684) - 2021-06-12
#### Change
* Update to TypeScript 4.3


--------
### [0.28.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/90f58f598ae74a828517809282b1a1a2d40502eb) - 2021-03-16
#### Change
* Remove `Q` dependency (still used as a devDependency)
* Update dependencies for `Q` dependency removal
* Change all `Q.Promise` and `Q.IPromise` types to `PsPromise` (from `ts-promises` package)


--------
### [0.27.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/c056a94c9e5b82462791a6424813f9da0188c174) - 2020-09-05
#### Change
* Update to TypeScript 4.0


--------
### [0.26.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/39dfa05b09461970715add93c0a3a409fa96b814) - 2020-08-12
#### Fixed
* Fix a bug adding items via `MemDbImpl.addOrUpdateWhere()` which affects `DataCollection` `addOrUpdateWhere()` and `addOrUpdateWhereNoModify()`, an extraneous `undefined: undefined` property was being added to the inserted item(s)


--------
### [0.26.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/72159ec478e8d4bdc1379e08502fc2b95465a3b4) - 2019-12-06
#### Changed
* Renamed interface `InMemDb` -> `MemDb`
* Renamed `InMemDbImpl.ts` -> `MemDbImpl.ts`

#### Removed
* `MemDb.createDataPersister()`, callers can access the appropriate classes and create persisters matching their needs


--------
### [0.25.2](https://github.com/TeamworkGuy2/lokijs-collections/commit/c8dedc33bd5832cd2ddb727b2d724b241c24cbe4) - 2019-11-08
#### Changed
* Updated to TypeScript 3.7 and other dependencies


--------
### [0.25.1](N/A) - 2019-06-18
#### Fixed
* Fix `WebSqlPersister` to throw an error instead of infinitely looping when trying to persist with a `maxObjectsPerChunk` of zero or null
* Fix a `WebSqlSpi` issue calling Database methods without a `this.` context
* Fix a TypeScript error when importing this into another project mixing TypeScript 3.2 and 3.5


--------
### [0.25.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/fe25ce829f45fe98352e88fc6eaf664061c24bd7) - 2019-06-18
#### Added
* Alpha quality `IndexedDbPersister` and `IndexedDbSpi` - unit test development started, still needs a lot of testing and some fixes

#### Changed
* `WebSqlSpi.WebSqlDatabase` flattened into just `WebSqlSpi` (`DbUtils` moved to `DbUtil`) 
* `WebSqlPersister.restore()` `defaultOptions` parameter no longer defaults `dataColumnName` to `WebSqlPersister.defaultDataColumnName` and `maxObjectsPerChunk` no longer defaults to `WebSqlPersister.MAX_OBJECTS_PER_PERSIST_RECORD`
* `WebSqlSpi.execSqlStatements()` `xactMethodType moved from last parameter position to second parameter
* `WebSqlPersister`
  * `tablesToNotClear` and `tablesToNotLoad` fields changed from static to instance and added to constructor parameters
  * `addCollectionRecords()` `options.maxObjectsPerChunk` no longer defaults to 1000, specify a value
* `DataPersister.Trace` renamed `DataPersister.DbLogger`
* Moved `WebsqlSpi.DbUtils` into its own file `DbUtil`
* Removed unnecessary try-catch-rethrow from `Resultset.where()`
* Changed some `Collection` catch blocks to log errors to `this.events.emit('error', ...)` instead of the `console`
* Update to TypeScript 3.5 and fix compile errors

#### Removed
* `MemDbCollection` and `Collection` `byExample()`, `findObject()`, and `findObjects()` use `DataCollection.data()` and `where()` instead

#### Fixed
* Fixed `Collection.lookup()` returning a method when passing `null` for the key
* Fixed `WebSqlPersister.createInsertStatements()` to always run `itemSaveConverter` on data rows being persisted regardless of other config options


--------
### [0.24.7](https://github.com/TeamworkGuy2/lokijs-collections/commit/ded1287120ad5e5c8061ceb883539f2bd3db9430) - 2019-03-21
#### Fixed
* `ts-code-generator` import/reference paths not being updated to `@twg2/ts-twg-ast-codegen`


--------
### [0.24.6](https://github.com/TeamworkGuy2/lokijs-collections/commit/aecb6eb65b113ef113424521ce3bbec4a01183e3) - 2019-03-20
#### Changed
* Switch `ts-mortar` and `ts-promises` dependencies from github to npm
* Switched dependency `ts-code-generator@0.20.2` to same npm project with new name `@twg2/ts-twg-ast-codegen@0.21.0`


--------
### [0.24.5](https://github.com/TeamworkGuy2/lokijs-collections/commit/74a73f58d87a2302e88b41d3c3718c1a3a7f7ebe) - 2019-03-14
#### Changed
* Update dependency `ts-mortar@0.16.0` (fix for `Strings.isDigit()`, removal of `Objects.getProps()` and `Strings.endsWith()`, and several other changes)


--------
### [0.24.4](https://github.com/TeamworkGuy2/lokijs-collections/commit/471d0519b9ce2cf67c01a40e111ae8ea9c2352dc) - 2018-12-29
#### Changed
* Update `ts-code-generator` dependency


--------
### [0.24.3](https://github.com/TeamworkGuy2/lokijs-collections/commit/4c444f08204e4855ebcf0f4ea377912b5502cada) - 2018-12-29
#### Changed
* Update to TypeScript 3.2 and fix compile errors
* Update dev and @types/ dependencies
* Remove `tsconfig.json lib "dom"` and cleanup code to not rely on browser globals
* Exposed `MemDbPersisters.localStorage` to allow for custom implementations


--------
### [0.24.2](https://github.com/TeamworkGuy2/lokijs-collections/commit/47af07fb2d812e162eb53cbff146fe4bc95048c3) - 2018-11-23
#### Changed
* Update dependency `ts-mortar@0.15.9` (fix for `Functions.lazy()` when initializer returns null)


--------
### [0.24.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/e29a058b2890dd9b678893f751e75594a18bb200) - 2018-10-20
#### Changed
* Switch `package.json` github dependencies from tag urls to release tarballs to simplify npm install (doesn't require git to npm install tarballs)


--------
### [0.24.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/e20cef7fec47e03a07a9e300c0882c0192ff7869) - 2018-10-17
#### Changed
* Update to TypeScript 3.1
* Update dev dependencies and @types
* Enable `tsconfig.json` `strict` and fix compile errors
* Removed compiled bin tarball in favor of git tags
* `MemDbCollectionOptions` now has a generic type which narrows the array type of `indices`, `exact`, and `unique` properties
* `mem-collections.d.ts` `keyof T` types restricted by `& string` across several method signatures

#### Fixed
* Ensure `TsEventEmitter.events` is always initialized


--------
### [0.23.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/366481064d944c29c8db4287cefcfd7eb412d2c3) - 2018-04-14
#### Changed
* Update to TypeScript 2.8
* Setup dependencies as proper npm node_modules
* Added release tarball and npm script `build-package` to package.json referencing external process to generate tarball

#### Removed
* Remove `ts-promises` unused dependency


--------
### [0.22.4](https://github.com/TeamworkGuy2/lokijs-collections/commit/e3e810e31685569bdda7303863acfe3b82368e03) - 2018-03-01
#### Changed
* Update to TypeScript 2.7
* Update dependencies: mocha, @types/chai, @types/mocha, @types/node
* Enable tsconfig.json `noImplicitAny`


--------
### [0.22.3](https://github.com/TeamworkGuy2/lokijs-collections/commit/4bf9eef6477323f1a6789bd1449e5760e9d7daeb) - 2018-01-31
#### Change
* SQLError message now included in errors thrown by WebSqlSpi _rejectError()

#### Fixed
* A bug in WebSqlPersister related to persisting empty collections


--------
### [0.22.2](https://github.com/TeamworkGuy2/lokijs-collections/commit/9888586b9a0152521490ff834fdd1f54f2bb37c6) - 2017-11-08
#### Fixed
* A bug in `WebSqlSpi.WebSqlDatabase.openDatabase()` that was rejecting the database initialization promise when the database was successfully opened
* `WebSqlPersister.WebSqlAdapter.persist()` now correctly tracks the byte size of the restored data strings
* DataCollection `mem-collections.d.ts` reference changed to `mem-db.d.ts` to fix compile issue when compiling just the DataCollection file


--------
### [0.22.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/34cd3d8fb02864f30a4d8af9563fb96995982cf4) - 2017-11-07
#### Change
* Updated and fixed some README info

#### Fixed
* Some errors when compiling without `strictNullChecks`
* Nested loop counter not getting initialized in `WebSqlSpi.execSqlStatements()` when passed a query with an `args` array containing one or more elements


--------
### [0.22.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/ee215894242c187ea25a55dc66d60eac1bcc6021) - 2017-11-06
__Integrate simplified version of Lokijs code into this project, remove Lokijs dependency__
#### Added
* Ported `lokijs@~1.3.0` to project and removed lokijs dependency from `package.json`
  * Copied lokijs into `db-collections` new classes: `Collection`, `DynamicView`, `Resultset`, `MemDbPersisters`, and `TsEventEmitter`
  * Removed lokijs 'deep.property.scan' query feature to reduce complexity
  * Removed LokiEventEmitter `asyncListeners` option since it causes performance issues
  * Delegation instead of inheritance: `Loki`, `Collection`, `DynamicView`, and `Resultset` no longer extend `EventEmitter`. All of these, excluding Resultset, now contain `events` fields which are instances of `EventEmitter`.
  * Merged `InMemDbImpl` with `Loki`
* `WebSqlSpi` containing low level interface for reading/writing parameterized queries to WebSQL tables in browser
* `WebSqlPersister` implements `DataPersister` and creates basic WebSQL queries for persisting and restoring `DataCollection`s
  * `WebSqlPersister` is decoupled for `WebSqlSpi` via a simple interface with two methods: `getTables()` and `executeQueries(WebSqlSpi.SqlQuery[])`

#### Changed
* Added `strictNullChecks` to `tsconfig.json` and updated code to handle nulls
* Improved data types with null checks
* Updated to ts-mortar@0.15.0 (strict null checks)
* Merged `Loki` dependency library/class with `InMemDbImpl`
* Renamed `InMemDb.getCollections()` -> `listCollections()`
* Renamed `InMemDbImpl` fields: `dbName` -> `name`, merged fields `syncSettings` and `storeSettings` into new `settings` field
* Merged and consolidated `Loki` interfaces with `in-mem-collections.d.ts` interfaces
* Renamed and split definition file `in-mem-collections.d.ts` into `mem-collections.d.ts`, `mem-db.d.ts`, and `mem-models.d.ts`
* Merged `DtoSvcFuncs` and `DtoAllFuncs` interfaces, renamed fields `convertToLocalObjectFunc` -> `toLocalObject` and `convertToSvcObjectFunc` -> `toSvcObject`

#### Removed
* `InMemDbImpl` fields: `db` and `dbInitializer`
* `InMemDbImpl` `databaseInitializer` constructor field and merged constructor fields `syncSettings` and `storeSettings` into new `settings` field
* `InMemDb` `initializeDb()` since there is no underlying `InMemDbProvider` anymore
* Removed `DtoSvcFuncs` interface (mreged with `DtoAllFuncs`


--------
### [0.21.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/91fdf7e3e226ee5165eed9923dba312d7dc6d1cc) - 2017-10-26
#### Changed
* `ModelDefinitions` interface changes:
  * `getPrimaryKeyNames()` renamed `getPrimaryKeys()`
  * `getAutoGeneratedKeyNames()` renamed `getAutoGeneratedKeys()`
  * `getFieldNames()` renamed `getFields()`
  * `getDataModel()` renamed `getModel()`

#### Removed
* Removed `ModelDefinitionsSet` fields: `dataTypes` and `models`
* Removed interface `ModelDefinitions.DataTypeDefault`


--------
### [0.20.5](https://github.com/TeamworkGuy2/lokijs-collections/commit/0b8818e887f1d814ab233060ed2a50cd84af7a8e) - 2017-08-05
#### Changed
* Update to TypeScript 2.4


--------
### [0.20.4](https://github.com/TeamworkGuy2/lokijs-collections/commit/7dded8ba43847c9cac4898c226d65a64405d21ba) - 2017-06-09
#### Changed
* Updated to latest version of ts-event-handlers-lite@0.2.0


--------
### [0.20.3](https://github.com/TeamworkGuy2/lokijs-collections/commit/5aaa564f0e8987aaf7d36aae853a38313fa9388e) - 2017-05-26
#### Changed
* Upgraded to TypeScript@2.3.3
* Improved LokiQueryLike type
* Added empty result check to `DataCollection.lookup()`; align behavior with single(). Also added `throwIfNotFound` flag to allow it to also work like `first()`


--------
### [0.20.2](https://github.com/TeamworkGuy2/lokijs-collections/commit/ecb7b11147bbf6a3edb0900e729dd1bd2d1fad07) - 2017-05-26
#### Changed
* Improved `first()` and `single()` implementation
* Some additional documentation


--------
### [0.20.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/e0c83fa2455829361d83c8524a376700ef9f7b60) - 2017-05-26
#### Added
* Added `DataCollection.single()` to provide single object lookup functionality


--------
### [0.20.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/991d8695d988e39f33d697c6660e4e4448b82adf) - 2017-05-26
#### Added
* Added `DataCollection.lookup()` to provide primary key lookup functionality

#### Changed
* Renamed DataCollection and InMemDb `findOne()` -> `first()`
* Improved `LokiQueryLike` interface
* Added more method documentation

#### Removed
* Removed/renamed `InMemDb.findSinglePropQuery()` -> `InMemDb.data()`


--------
### [0.19.2](https://github.com/TeamworkGuy2/lokijs-collections/commit/f1a08526a36306d4a7f249cf49606b82dea81944) - 2017-05-22
#### Changed
* Fixed an issue with Query<E> not matching valid queries
* Renamed/changed Query<E> definition to LokiQueryLike<E, K>


--------
### [0.19.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/b1e14f44afa302ae641f34b076224495d891ffc3) - 2017-05-19
#### Changed
* Improved DataCollection `E` and `P` types and fixed `Query<E>` type bug


--------
### [0.19.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/e001b138586aeb496daf6f725493fa0d1e822112) - 2017-05-19
#### Changed
* `DataCollection<E, O>` changed to `DataCollection<E, P>` - `O` represented an optional props version of `E`, `P` now represents the required primary key props of the `E` model and `Partial<E>` is used internally in place of `O`
  * Improved type of 'query' parameters used by data(), find(), updateWhere(), and similar methods
* Added missing types and tightened type requirements on various InMemDb and DataCollection methods
* Added additional DataPersister methods to allow for more control of the underlying persistent data source


--------
### [0.18.2](https://github.com/TeamworkGuy2/lokijs-collections/commit/f7d694069d7f183625b84a5a4a363834cbf51018) - 2017-05-09
#### Changed
* Updated some documentation
* Updated to TypeScript 2.3, added tsconfig.json, use @types/ definitions


--------
### [0.18.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/4bc77584275cdedba2be1844e9d96e4a2bc23ba7) - 2017-04-19
#### Changed
* ModelDefinitionsSet.cloneDtoPropertyTemplate() now includes 'server.toLocal'


--------
### [0.18.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/8129574d9c1fd3cb0d97993111efa5bb25cfe73f) - 2017-03-01
#### Changed
* DataCollectionModel fieldNames, primaryKeys, and autoGeneratedKeys type changed from string to keyof


--------
### [0.17.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/3dcd51e786b1684711da893ffa0bcff1970ef94d) - 2016-12-29
#### Changed
* Renamed LokiDbImpl -> InMemDbImpl
* Renamed LokiDbImplTest -> InMemDbImplTest
* Some test case refactoring, new CloneBenchmarkTest and TestModels files

#### Removed
* InMemDbImpl.benchmarkClone() method moved to new CloneBenchmarkTest file


--------
### [0.16.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/12e2c99012407c85d07a42dabf1b4244c604b87e) - 2016-12-21
#### Changed
* Switched from Lokijs explicit import and type usage to new InMemDbProvider interface (moving away from Lokijs dependency toward generic in-mem DB API)
* Removed LokiDbImpl.getCollection() 'settings' parameter, instead use LokiDbImpl 'createCollectionSettingsFunc' parameter
* Removed unused LokiDbImpl.initializeDb() 'options' parameter
* Added LokiDbImpl constructor parameters 'createCollectionSettingsFunc' and 'modelKeysFunc' to give more control over Lokijs specific implementation details
* TypeScript 2.0 compatibility tweaks


--------
### [0.15.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/68ea086ce7f1ae03c9764eb50bfe3d719a9e366f) - 2016-11-03
#### Added
* LokiDbImpl() constructor 'reloadMetaData' flag and 'dbInitializer' function parameters
* PrimaryKeyMaintainer() constructor 'reloadAll' flag parameter

#### Removed
* LokiDbImpl private _setNewDb() method and private static _createNewDb() method in favor of initializeDb() and the constructor's new 'dbInitializer' parameter

#### Fixed
* primary key maintainer now properly handles collection data model 'autoGeneratedKeys' changes.  Previously if the model changed, the PrimaryKeyMaintainer would end up confusing the old keys with the new keys and add the wrong auto-generated properties to objects missing them.


--------
### [0.14.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/b8648b5b1e57aea9815e8100dbc8d63e73448f54) - 2016-09-19
#### Changed
* Updated to version 0.11.0 of ts-mortar which moved ts-mortar/events/ to a separate library
  * Added ts-event-handlers-lite@0.1.0 dependency for the EventListenerList previously provided by ts-mortar and used by DataCollection


--------
### [0.13.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/13ecd777d599665f2c6a4a34da1e24d82289d7d0) - 2016-08-24
#### Fixed
* Fixed some .d.ts paths to match DefinitelyTyped structure
* Fixed issue with ModelDefinitionsSet.cloneDtoPropertyTemplate()


--------
### [0.13.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/5f70bf6ade8959303f80bf33a658a3f8d1bb9805) - 2016-05-27
#### Changed
* Renamed PermissionedDataPersistAdapter -> PermissionedDataPersister
* Renamed DataPersister.AdapterFactory -> DataPersister.Factory
* Renamed DataPersister.clearPersistenceDb() -> clearPersistentDb()
* Moved DataPersister.Adapter interface up and merged it with DataPersister module
* Made DataCollection.collection public to make it easy to access the underlying lokijs collection (please note this field is meant to be readonly)

#### Removed
* sync/ directory moved to new [lokijs-collections-sync](https://github.com/TeamworkGuy2/lokijs-collections-sync) library


--------
### [0.12.5](https://github.com/TeamworkGuy2/lokijs-collections/commit/067fe49f6093a8738178da4ba271884aa701d4c3) - 2016-05-27
#### Changed
* More thorough error handling in SyncDataCollection.syncDownCollection()

#### Removed
* Removed last modified timestamp filtering when updating local items after syncing up since primary key filtering should already restrict the search results sufficently


--------
### [0.12.4](https://github.com/TeamworkGuy2/lokijs-collections/commit/fe17c01f5a2d43ea2a2551b715484f87060f645c) - 2016-05-26
#### Changed
* work with latest version of ts-promises library
* use mocha and chai for tests instead of qunit


--------
### [0.12.3](https://github.com/TeamworkGuy2/lokijs-collections/commit/2013d7e8a34139d5585742766464ec980a1835d9) - 2016-05-26
#### Changed
* Changed to work with latest version of ts-mortar and new ts-typed-promises library


--------
### [0.12.2](https://github.com/TeamworkGuy2/lokijs-collections/commit/03c4bb6bb3c9f517d1d97fd0a21750735564bcca) - 2016-05-25
#### changed
* Replaced two console.error() calls with throw new Error()

#### Fixed
* Added 'syncingDown' error property to syncDownCollection() and changed 'syncDownFunc' type so sync functions don't have to return a SyncError


--------
### [0.12.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/898017578049040d57c28e22ce3b48ed270a3a43) - 2016-05-24
#### Changed
* Updated to use new version of ts-mortar and new ts-promise-tasks library
* Updated readme

#### Fixed
* Fixed error in syncUpCollection() not rejecting promise correctly if sync function failed


--------
### [0.12.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/18742e8218df57d207a3c09b6ec37f23a2437144) - 2016-05-18
#### Changed
* Added some documentation to change-trackers, db-collections, and sync
* Renamed ChangeTrackersImpl -> ChangeTrackers
* Renamed DataCollectionImpl -> DataCollection


--------
### [0.11.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/f8669c724cfda4f778e2612c73323b4b2cad5ec8) - 2016-05-15
#### Added
* Added DtoCollection which extends DataCollection and changes the parameters/return types of some functions with the goal of making a collection interface for DTO server syncable collections
  * renamed DataCollectionImpl.fromWebServiceModel() -> fromDtoModel() (which returns the new DtoCollection type) and added fromDataModel() (which returns the existing DataCollection type)

#### Changed
* ts-code-generator library required version bumped to 0.15.0 - small name and type changes to work with latest version
* Moved ModelDefinitions.dataTypes type to it's own ModelDefinitions.DataTypeDefault interface
* Refactored collection models, they are now split into two pieces: DtoModel and DtoFuncs or DtoAllFuncs, instead of being combined, this changes several interfaces and function signatures:
  * Renamed interfaces:
    * DataCollectionModelFuncs -> DtoFuncs
	* DataCollectionModelSvcFuncs -> DtoSvcFuncs
	* DataCollectionModelAllFuncs -> DtoAllFuncs
  * Function signature includes new 'modelFuncs' or similar parameter:
    * DataCollectionImpl.fromWebServiceModel()
    * ModelDefinitionsSet: addModel(), modelDefToCollectionModelDef(), and modelDefsToCollectionModelDefs()

#### Fixed
* ModelDefinitionsSet.cloneDtoPropertyTemplate() was incorrectly converting 'undefined' default values to 'null'


--------
### [0.10.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/3f3c02986468191c1246f155dbdd7204642e07f7) - 2016-05-14
#### Changed
* updated ts-code-generator package version, requires 0.14.1 or higher,
* updated interfaces name referencess to matched new/renamed interfaces from ts-code-generator interface definitions
* Renamed ModelDefinitionsSet methods:
  * extendModelDef() -> extendModelTemplate()
  * multiExtendModelDef() -> multiExtendModelTemplate()
* Renamed in-mem-collections.d.ts interfaces:
  * CollectionModel -> DtoCollectionModel
  * CollectionSvcModel -> DtoCollectionSvcModel
  * CollectionSvcModelNamed -> DtoCollectionSvcModelNamed


--------
### [0.10.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/8c272049bf7536d3d94b600416a7698a2f733480) - 2016-05-13
#### Added
* ModelDefinitions.modelNames array (also added to subclass ModelDefinitionsSet) for easy access instead of having to use Object.keys()
* Added CollectionSvcModelNamed interface

#### Changed
* ModelDefinitions.models (and ModelDefinitionsSet.addModel() and constructor) now add a 'name' property to the models
* Improved ModelDefinitionsSet.cloneDeep data type.
* Renamed interfaces:
  * CollectionModelDef -> CollectionModel
  * CollectionModelWithSvcDef -> CollectionSvcModel

#### Fixed
* ModelDefinitionsSet.addModel() now copies when storing it internally to match constructor behavior


--------
### [0.9.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/78027fe330f1777e523e803cf0c6628283d244da) - 2016-05-06
#### Changed
* Added cloneWithoutMetaData_clone_delete() to mirror original clone functionality
* Renamed LokiDbImpl clone methods to cloneCloneDelete(), cloneForInIf(), cloneKeysExcludingFor(), cloneKeysForIf()


--------
### [0.9.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/59f4dad4c5a7b6edfd563ae5a137b5c32ed6e3b2) - 2016-05-05
#### Changed
* Updated to use latest version of ts-mortar 0.5.4 (renamed Objects.cloneMap() -> map())
* Added cloneType string parameter to LokiDbImpl constructor
* Renamed LokiDbImpl.prototype.stripMetaData() -> cloneWithoutMetaData()
* Renamed LokiDbImpl.stripMetaData() in favor of cloneDeepWithoutMetaData() or one of the specific implementations: cloneWithoutMetaData_for_in_if(), cloneWithoutMetaData_keys_excluding_for(), cloneWithoutMetaData_keys_for_if()


--------
### [0.8.2](https://github.com/TeamworkGuy2/lokijs-collections/commit/025a7db56bc4c2359a42a72175eed7ae54969a85) - 2016-04-20
#### Added
* A CHANGELOG.md covering all previous releases after being reminded about the need for change longs on http://keepachangelog.com/
* ModelDefinitionsSet.cloneDtoPropertyTemplate()

#### Changed
* Moved .d.ts definition files to separate definitions library
* Moved ts-mortar dependency location
* Updated TypeScript compiler to 1.8
* Removed lodash dependency, in favor of optional caller provided 'cloneDeep' function parameters to various functions with default fallback to 'ts-mortar' Objects.cloneDeep()


--------
### [0.8.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/15f9c319ad19b138a45d30b720370c6c84210fba) - 2016-03-12
#### Added
* SyncDataCollection documention

#### Changed
SyncSettingsBuilder (unifying function names):
* Added fromDataCollectionAndSyncFuncs() 'findFilterFunc' parameter
* Renamed setSettings() -> addSettingsInst()
* Renamed setSyncDown() -> addSyncDownSettings()
* Renamed setSyncUp() -> addSyncUpSettings()


--------
### [0.8.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/0e11c4e51b1af04ed8bd3bc84fd0abb4e2f418a4) - 2016-03-11
#### Added
'Syncing' functionality - for asynchronously sending and receiving DataCollection data and merging it with an existing data collection
* sync/SyncDataCollection.ts - with syncDownCollection() and syncUpCollection() functions as well as parameters to control how changes are synced, see:
  * SyncDataCollection.SyncDownOp enum - which provides options for removing or preserving existing data during a sync and adding or merging new data
* sync/SyncSettingsBuilder.ts - a someone complex Builder pattern class for building SyncSettings* interface instances
* sync/syncing-types.d.ts - with all the new interfaces

#### Changed
* ModelDefinitionsSet constructor 'dataModels' parameter string map and addModel() 'model' types changed from CollectionModelDef -> CollectionModelWithSvcDef
* Added DataCollectionImpl constructor 'dataModelFuncs' parameter
* Renamed interface CollectionDataModel -> DataCollectionModel


--------
### [0.7.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/d482dd4fa281f664214404f4e9940eb0e145bffe) - 2015-12-22
#### Fixed
* LokiDbImpl.removeWhere() bug not properly querying the collection and not properly removing when query returned multiple results


--------
### [0.7.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/1dae6d753ab87fa0903d13de3f9af1c98c1ca979) - 2015-12-20
#### Added
* InMemDb.initializeLokijsDb() to allow the underlying database to be constructed after creating an InMemDb instance
* DataPersister.AdapterFactory interface

#### Changed
* Decoupled DataPersister interface from InMemDb
* Updated test cases

#### Removed
* LokiDbImpl _findOneOrNull(), _findNResults(), _findMultiProp() have been removed from the public API
* Several DataPersister.Adapter: setDataStoreInterface(), setDataSources(), setDataConverters(), save(), and load() functions


--------
### [0.6.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/50c3d41b503596fb1c87e71743a05a4fc715758c) - 2015-12-17
#### Changed
* ModelDefinitionsSet extendModelDef() and multiExtendModelDef() 'DtoPropery' string map parameters changed to 'DtoPropertyTemplate' string maps


--------
### [0.6.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/a48e7514da158c77377e83ec6eb1947ecb80f148) - 2015-12-17
#### Added
* Added first qunit test cases for LokiDbImpl
* Added ModelDefinitionsSet.addModel()

#### Changed
* Renamed CollectionDataModelImpl -> ModelDefinitionsSet
* Renamed interface WebServiceModelDef -> DtoModelTemplate
* LokiDbImpl internal class name updated from InMemDbImpl to LokiDbImpl to match file name

#### Removed
* Removed SimpleTemplate interface, see ts-code-generator project


--------
### [0.5.2](https://github.com/TeamworkGuy2/lokijs-collections/commit/a80042dbea2e777de66d0b4b96f586a0f048753b) - 2015-12-16
#### Added
* Added DataCollectionImpl.fromWebServiceModel() static constructor
* Added CollectionDataModelImpl modelDefToCollectionModelDef() and modelDefsToCollectionModelDefs() to convert WebServiceModelDef or CollectionModelDef objects to CollectionDataModel

#### Changed
* Renamed DefaultModelDefinitions -> CollectionDataModelImpl
* CollectionDataModel interfaces 'copyFunc' return type narrowed from any to E


--------
### [0.5.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/83983ebb2b21761c87d03c33ed65b363f53f07ba) - 2015-12-15
#### Changed
* ModelDefinitionsTemplate interface renamed SimpleTemplate and no longer extends ModelDefinitions, 'templateVariables' property renamed 'templateExpressions'
* Copied .d.ts definition files from DefinitelyTyped for Q, lodash, lokijs, and qunit

#### Fixed
* DefaultModelDefinitions.generateAdditionalModelsInfo() nested loop reusing 'i' and 'size' variables bug



--------
### [0.5.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/b87029bfb7d3c8b4b3ca55913b21d21ac7da9d6f) - 2015-12-15
#### Added
* data-model/DefaultModelDefinitions.ts - a map of model definitions for an entire database, see Changed notes below

#### Changed
* Major API refactor, switched to data model backed design. Each collection is backed by a runtime data model containing a list of properties belonging to that model, each fields' client and server name, data type, server-to-client and client-to-server conversion code, as well as an optional manual copy function.
* DataCollection constructor and multiple InMemDb function interfaces definitions require a new 'dataModel' parameter, related implementation code updated as well

#### Removed
* ModelKeysImpl getUniqueIdNames() and getGeneratedIdNames() in favor of new getDataModel() function


--------
### [0.4.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/9cbafcd7060f2b8a8fb1d4afb812d8b6cebcf070) - 2015-12-11
#### Changed
* Replaced some lodash function calls with plain javascript equivalent code in LokiDbImpl (goal of removing lodash dependency completely)

#### Fixed
* ChangeTrackersImpl bug was causing addChange*() functions to count arrays of item changes as only 1 change
* LokiDbImpl stripMetaData() now removes Lokijs '$loki' and 'meta' properties from cloned objects


--------
### [0.4.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/d7257f8efcceb7283b4d5fb80fcbb9d8dcc63850) - 2015-11-21
#### Added
* DataCollection interface

#### Changed
* Renamed DataCollection -> DataCollectionImpl


--------
### [0.3.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/97e26c0dae5021e6e789470ae21da133dad96c28) - 2015-11-19
#### Added
NonNullKeyMaintainer for checking null fields in collections

#### Changed
* Moved PermissionedDataPersistAdapter from LokiDbImpl to 'db-collections/PermissionedDataPersisterAdapter.ts'
* PrimaryKeyMaintainer.manageKeys() now requires an array of items to manage, instead of allowing either an array or one item

#### Removed
Removed collection name based API from InMemDb and related classes, API now requires collection instance rather than collection name for DB CRUD functions.
Also modified most of the InMemDb function names, removed '_' prefix, added 'noModify' parameters


--------
### [0.2.1](https://github.com/TeamworkGuy2/lokijs-collections/commit/48db9390a47ea92660e3eb45920cf69032c6c922) - 2015-11-17
#### Changed
* Split ModelDefinitions into two interfaces, new 'ModelDefinitionsTemplate extends ModelDefinitions'
* Removed ModelDefinitions 'templateStartMark', 'templateEndMark', and 'templateInputLinks' properties
* These properties become 'templateDelimiterStart', 'templateDelimiterEnd', and 'templateContextPropLinks' in ModelDefinitionsTemplate
* Updated ts-mortar and ts-code-generator dependency versions


--------
### [0.2.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/268d29ff8ae735074142dd09a06116e797435f28) - 2015-11-11
#### Changed
* Renamed InMemDbImpl -> LokiDbImpl
* Moved DataCollection and LokiDbImpl to db-collections/ directory
* LokiDbImpl and PrimarykeyMaintainer constructors requires a name parameter for the internal metadata collection
* ModelDefinitions 'models' string map type changed from ServiceTypesDefinition -> WebServiceModelDef


--------
### [0.1.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/66248019322009f5ee5e6592267fb9843798bf3d) - 2015-11-10
#### Added
Initial commit of code for accessing [Lokijs](https://github.com/techfort/LokiJS) collections in a strongly typed way in TypeScript
* DataCollection.ts - with add, update, remove, and find functions including variations such as addOrUpdateWhere() which performs a query and updates existing items or adds a new item depending on if there are any existing items
* InMemDbImpl.ts - a wrapper around a lokijs database instance which exposes operations such as add, update, find, findOne, clear, and remove.  This acts as a layer of separation between a DataCollection (high level queries, add, and remove) and database specific details such as transactions, error handling, event logging, etc which are handled by this class
* change-trackers/ChangeTrackersImpl.ts - for constructing objects which count 'added', 'modified', and 'removed' changes
* change-trackers/collection-changes.d.ts - interfaces for change trackers
* in-mem-collections.d.ts - interfaces for DataCollection, in-mem database, database serialization and deserialization APIs, and colllection metadata models
* key-constraints/CollectionMetaData.ts - simple collection metadata, currently including collection name, primary key column names, and auto-generated column names with last auto-generated key
* key-constraints/ModelKeysImpl.ts - functions for tracking and generating auto-generated keys
* key-constraints/PrimaryKeyMaintainer.ts - manages loading, tracking, and generating unique keys