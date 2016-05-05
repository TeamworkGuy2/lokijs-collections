# Change Log
All notable changes to this project will be documented in this file.
This project does its best to adhere to [Semantic Versioning](http://semver.org/).


#### [Unreleased]
* Added cloneWithoutMetaData_clone_delete() to mirror original clone functionality


### [0.9.0](https://github.com/TeamworkGuy2/lokijs-collections/commit/59f4dad4c5a7b6edfd563ae5a137b5c32ed6e3b2) - 2016-05-05
#### Changed
* Updated to use latest version of ts-mortar 0.5.4 (renamed Objects.cloneMap() -> map())
* Added cloneType string parameter to LokiDbImpl constructor
* Renamed LokiDbImpl.prototype.stripMetaData() -> cloneWithoutMetaData()
* Renamed LokiDbImpl.stripMetaData() in favor of cloneDeepWithoutMetaData() or one of the specific implementations: cloneWithoutMetaData_for_in_if(), cloneWithoutMetaData_keys_for_if(), or cloneWithoutMetaData_keys_excluding_for()


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