/// <reference path="../definitions/lib/Q.d.ts" />
/// <reference path="../definitions/lib/lokijs.d.ts" />
import _ = require("lodash");
import Q = require("q");
import Loki = require("lokijs");
import ChangeTrackersImpl = require("../change-trackers/ChangeTrackersImpl");
import ModelKeysImpl = require("../key-constraints/ModelKeysImpl");
import PrimaryKeyMaintainer = require("../key-constraints/PrimaryKeyMaintainer");


function stripMetaData(obj: any): any {
    var returnValue = _.clone(obj);

    delete returnValue.$loki;
    delete returnValue.meta;

    return returnValue;
}


/** A {@link ResultSetLike} implementation for an empty collection
 * @author TeamworkGuy2
 */
class ResultsetMock<E> implements ResultSetLike<E> {

    data() {
        return [];
    }

    find() {
        return this;
    }

    offset() {
        return this;
    }

    limit() {
        return this;
    }

    simplesort() {
        return this;
    }

    where() {
        return this;
    }

}


/** {@link DataPersister.Adapter} wrapper that checks permissions before reading/writing data
 * @author TeamworkGuy2
 */
class PermissionedDataPersistAdapter implements DataPersister.Adapter {
    private persister: DataPersister.Adapter;
    private syncSettings: ReadWritePermission;
    private storeSettings: StorageFormatSettings;


    constructor(persister: DataPersister.Adapter, syncSettings: ReadWritePermission, storeSettings: StorageFormatSettings) {
        this.syncSettings = syncSettings;
        this.storeSettings = storeSettings;
        this.persister = persister;
    }


    public setDataStoreInterface(getDataStore: () => Loki, setDataStore: (newStore: Loki) => void, createDataStore: (options: LokiConfigureOptions) => Loki) {
        this.persister.setDataStoreInterface(getDataStore, setDataStore, createDataStore);
    }


    public setDataSources(getDataSources: () => LokiCollection<any>[]) {
        this.persister.setDataSources(getDataSources);
    }


    public setDataConverters(saveItemTransformation?: (item) => any, restoreItemTransformation?: (item) => any) {
        this.persister.setDataConverters(saveItemTransformation, restoreItemTransformation);
    }


    public save(callback?: (err) => void) {
        if (this.syncSettings.writeAllow) {
            this.persister.save(callback);
        }
    }


    public load(options, callback?: (err) => void) {
        if (this.syncSettings.readAllow) {
            this.persister.save(callback);
        }
    }


    public persist(): Q.Promise<DataPersister.PersistResult> {
        if (this.syncSettings.writeAllow) {
            return this.persister.persist({ compress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister write permission denied due to settings");
            return dfd.promise;
        }
    }


    public restore(): Q.Promise<DataPersister.RestoreResult> {
        if (this.syncSettings.readAllow) {
            return this.persister.restore({ decompress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister read permission denied due to settings");
            return dfd.promise;
        }
    }


    public clearPersistenceDb(): Q.Promise<void> {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearPersistenceDb();
        }
        else {
            var dfd = Q.defer<any>();
            dfd.reject("permission denied: data persister write permission denied due to settings");
            return dfd.promise;
        }
    }

}


class InMemDbImpl implements InMemDb {
    private cache: StringMap<any>;
    private primaryKeyMaintainer: PrimaryKeyMaintainer;
    private metaDataStorageCollectionName: string;
    private modelDefinitions: ModelDefinitions;
    private modelKeys: ModelKeys;
    private db: Loki;
    private dbName: string;
    private dataPersisterFactory: (dbInst: InMemDb) => DataPersister.Adapter;
    private saveRestore: DataPersister.Adapter;
    private syncSettings: ReadWritePermission;
    private storeSettings: StorageFormatSettings;


    constructor(dbName: string, settings: ReadWritePermission, storeSettings: StorageFormatSettings, metaDataStorageCollectionName: string,
            modelDefinitions: ModelDefinitions, dataPersisterFactory: (dbInst: InMemDb) => DataPersister.Adapter) {
        this.dbName = dbName;
        this.syncSettings = settings;
        this.storeSettings = storeSettings;
        this.modelDefinitions = modelDefinitions;
        this.modelKeys = new ModelKeysImpl(modelDefinitions);
        this.dataPersisterFactory = dataPersisterFactory;
        this.metaDataStorageCollectionName = metaDataStorageCollectionName;
        this.cache = {};

        this.getCollections = this.getCollections.bind(this);
        this.saveRestore = InMemDbImpl.createDefaultDataPersister(this, dataPersisterFactory);
    }


    // ==== private methods ====
    private _createNewDb(dbName: string, options: LokiConfigureOptions) {
        return new Loki(dbName, options);
    }


    private _setNewDb(dataStore: Loki) {
        this.db = dataStore;
    }


    private static createDefaultDataPersister(dbDataInst: InMemDbImpl, dataPersisterFactory: (dbInst: InMemDb) => DataPersister.Adapter): DataPersister.Adapter {
        var dataPersister = dataPersisterFactory(dbDataInst);
        var persistAdapter = new PermissionedDataPersistAdapter(dataPersister, dbDataInst.syncSettings, dbDataInst.storeSettings);
        dbDataInst.setDataPersister(persistAdapter);
        return persistAdapter;
    }


    public getModelDefinitions() {
        return this.modelDefinitions;
    }


    public getModelKeys() {
        return this.modelKeys;
    }


    public resetDataStore(): Q.Promise<void> {
        var dfd = Q.defer<void>();
        this.db = null;
        this.saveRestore = InMemDbImpl.createDefaultDataPersister(this, this.dataPersisterFactory);
        dfd.resolve(null);
        return dfd.promise;
    }


    public setDataPersister(dataPersister: DataPersister.Adapter): Q.Promise<void> {
        var dfd = Q.defer<void>();
        this.db = null;
        this.saveRestore = dataPersister;
        // link the data persister to this objects data collections and data store instances
        dataPersister.setDataStoreInterface(
            () => this.db,
            (dataStore: Loki) => this._setNewDb(dataStore),
            (options) => this._createNewDb(this.dbName, options)
        );
        dataPersister.setDataSources(this.getCollections);
        dataPersister.setDataConverters(stripMetaData, null);

        dfd.resolve(null);
        return dfd.promise;
    }


    public getDataPersister(): DataPersister.Adapter {
        return this.saveRestore;
    }


    _removeCollection(collection: LokiCollection<any>, dstMetaData?: Changes.CollectionChangeTracker) {
        if (dstMetaData) {
            var collection = this.db.getCollection<any>(collection.name);
            if (collection) {
                dstMetaData.addChangeItemsRemoved(collection.data.length);
            }
        }

        if (collection) {
            this.db.removeCollection(collection.name);
        }
    }


    public getCollections(): LokiCollection<any>[] {
        return this.db.collections;
    }


    _getCollection(collectionName: string, autoCreate?: boolean): LokiCollection<any> {
        autoCreate = true;
        collectionName = collectionName.toLowerCase();
        var coll = this.db.getCollection(collectionName);
        if (!coll) {
            if (!autoCreate) {
                return;
            }
            else {
                coll = this.db.addCollection(collectionName, { asyncListeners: false }); // async listeners cause performance issues (2015-1)
                coll.isDirty = true;
            }
        }
        return coll;
    }
    // end Loki reliant methods


    // Crud Operations =========================
    public add<T>(collectionName: string, docs: T, dstMetaData?: Changes.CollectionChangeTracker): T;
    public add<T>(collectionName: string, docs: T[], dstMetaData?: Changes.CollectionChangeTracker): T {
        return <any>this._addHandlePrimaryAndGeneratedKeys(collectionName, ModelKeysImpl.Constraint.NON_NULL, ModelKeysImpl.Generated.AUTO_GENERATE, docs, dstMetaData);
    }

    public addAll<T>(collectionName: string, docs: T[], dstMetaData?: Changes.CollectionChangeTracker): T[] {
        return this.add(collectionName, docs, dstMetaData);
    }


    public addNoModify<T>(collectionName: string, docs: T, dstMetaData?: Changes.CollectionChangeTracker): T;
    public addNoModify<T>(collectionName: string, docs: T[], dstMetaData?: Changes.CollectionChangeTracker): T {
        return <any>this._addHandlePrimaryAndGeneratedKeys(collectionName, ModelKeysImpl.Constraint.NON_NULL, ModelKeysImpl.Generated.PRESERVE_EXISTING, docs, dstMetaData);
    }


    _addToCollection<T>(collection: LokiCollection<T>, docs: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T[] {
        return this._addToCollectionHandlePrimaryAndGeneratedKeys(collection, ModelKeysImpl.Constraint.NON_NULL,
            noModify ? ModelKeysImpl.Generated.PRESERVE_EXISTING : ModelKeysImpl.Generated.AUTO_GENERATE,
            docs, dstMetaData);
    }

    _addToCollectionAll<T>(collection: LokiCollection<T>, docs: T[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker): T[] {
        return this._addToCollection(collection, docs, noModify, dstMetaData);
    }


    _addHandlePrimaryAndGeneratedKeys<T>(collectionName: string, primaryConstraint: ModelKeysImpl.Constraint,
            generateOption: ModelKeysImpl.Generated, docs: T[], dstMetaData?: Changes.CollectionChangeTracker): T[] {
        var collection = this._getCollection(collectionName, true);
        return this._addToCollectionHandlePrimaryAndGeneratedKeys(collection, primaryConstraint, generateOption, docs, dstMetaData);
    }


    _addToCollectionHandlePrimaryAndGeneratedKeys<T>(collection: LokiCollection<T>, primaryConstraint: ModelKeysImpl.Constraint,
            generateOption: ModelKeysImpl.Generated, docs: T[], dstMetaData?: Changes.CollectionChangeTracker): T[] {
        // TODO primaryConstraint and generateOption validation
        if (!docs || docs.length === 0) {
            return;
        }
        var docsIsAry = Array.isArray(docs);

        // generate auto-generated keys if requested before checking unique IDs since the auto-generated keys may be unique IDs
        if (this.primaryKeyMaintainer == null) {
            this.primaryKeyMaintainer = new PrimaryKeyMaintainer(this.metaDataStorageCollectionName, this, this.modelKeys);
        }
        this.primaryKeyMaintainer.manageKeys(collection.name, docs, generateOption === ModelKeysImpl.Generated.AUTO_GENERATE);
        //Ensure a legacy uniqueId field is present
        if (primaryConstraint === ModelKeysImpl.Constraint.NON_NULL) {
            var keyNames = this.modelKeys.getUniqueIdNames(collection.name);
            if (keyNames.length > 0) {
                var checkKeys = (doc) => {
                    for (var ii = 0, sizeI = keyNames.length; ii < sizeI; ii++) {
                        if (doc[keyNames[ii]] == null) {
                            throw new Error("Attempting to insert object into " + collection.name + " without valid unique keys: [" + keyNames + "]");
                        }
                    }
                }

                if (docsIsAry) {
                    docs.forEach(checkKeys);
                } else {
                    checkKeys(docs);
                }
            }
        }
        else if (primaryConstraint === ModelKeysImpl.Constraint.UNIQUE) {
            throw new Error("ModelKeysImpl.Constraint.UNIQUE is not yet supported");
        }

        if (dstMetaData) {
            dstMetaData.addChangeItemsAdded(docsIsAry);
        }

        collection.isDirty = true;
        this.dataAdded(collection, docs, null, dstMetaData);
        return collection.insert(docs);
    }


    public update(collectionName: string, doc, dstMetaData?: Changes.CollectionChangeTracker) {
        var collection = this._getCollection(collectionName, true);
        return this._update(collection, doc, dstMetaData);
    }


    _update(collection: LokiCollection<any>, doc, dstMetaData?: Changes.CollectionChangeTracker) {
        if (dstMetaData) {
            dstMetaData.addChangeItemsModified(doc);
        }

        collection.isDirty = true;
        this.dataModified(collection, doc, null, dstMetaData);
        return collection.update(doc);
    }


    public find(collectionName: string, query?: any): ResultSetLike<any> {
        var collection = this._getCollection(collectionName, false);
        return this._find(collection, query);
    }


    _find<T>(collection: LokiCollection<T>, query?: any, queryProps?: string[]): ResultSetLike<T> {
        //Check for empty collection
        // TODO remove, users should never request non-existent collections
        if (!collection) {
            return new ResultsetMock();
        }
        else if (collection.data.length === 0) {
            return collection.chain();
        }

        //Get all results
        var queryProps = queryProps ? queryProps : (query ? Object.keys(query) : null);
        var results = collection.chain().find();
        //Support for multiple criteria in one query
        for (var i = 0, size = (queryProps ? queryProps.length : 0); i < size; i++) {
            var prop = queryProps[i];
            var localQuery = {};
            localQuery[prop] = query[prop]
            results = results.find(localQuery);
        }
        return results;
    }


    _findSinglePropQueryData<T>(collection: LokiCollection<T>, query?: any, queryProps?: string[]): T[] {
        if (!collection) {
            throw new Error("null collection with query: " + query);
        }
        else if (collection.data.length === 0) {
            return [];
        }

        //Get all results
        var queryProps = queryProps ? queryProps : (query ? Object.keys(query) : null);
        if (queryProps && queryProps.length > 1) {
            throw new Error("query '" + query + "' has more than 1 prop, _findSinglePropQueryData() only accepts 1 prop");
        }
        var results = collection.find(query);
        return results;
    }


    public remove(collectionName: string, doc, dstMetaData?: Changes.CollectionChangeTracker) {
        var collection = this._getCollection(collectionName)
        return this._remove(collection, doc, dstMetaData);
    }


    _remove(collection: LokiCollection<any>, doc, dstMetaData?: Changes.CollectionChangeTracker) {
        if (!collection) {
            return;
        }
        if (dstMetaData) {
            dstMetaData.addChangeItemsRemoved(doc);
        }

        collection.isDirty = true;
        this.dataRemoved(collection, doc, null, dstMetaData);
        return collection.remove(doc);
    }


    // Utility methods =========================

    public clearCollection(collectionName: string, dstMetaData?: Changes.CollectionChangeTracker) {
        var col = this._getCollection(collectionName);
        this._clearCollection(col, dstMetaData);
    }


    _clearCollection(collection: LokiCollection<any>, dstMetaData?: Changes.CollectionChangeTracker) {
        if (collection) {
            if (dstMetaData) {
                dstMetaData.addChangeItemsRemoved(collection.data.length);
            }

            collection.isDirty = true;
            collection.clear();
        }
    }


    public removeCollection(collectionName: string, dstMetaData?: Changes.CollectionChangeTracker) {
        var col = this._getCollection(collectionName);
        this._removeCollection(col, dstMetaData);
    }


    /** Query a collection, similar to {@link #find()}, except that exactly one result is expected
     * @return {Object} a single object matching the query specified
     * @throws Error if the query results in more than one or no results
     */
    public findOne(collectionName: string, query) {
        var collection = this._getCollection(collectionName, false);
        return this._findOne(collection, query);
    }


    _findOne(collection: LokiCollection<any>, query) {
        return this._findNResults(collection, 1, 1, query);
    }


    _findOneOrNull(collection: LokiCollection<any>, query) {
        return this._findNResults(collection, 0, 1, query);
    }


    _findNResults(collection: LokiCollection<any>, min: number, max: number, query) {
        if (min > max) {
            throw new Error("illegal argument exception min=" + min + ", max=" + max + ", min must be less than max");
        }

        var res = this._find(collection, query).data();
        if (res.length < min || res.length > max) {
            throw new Error("could not find " + (max == 1 ? (min == 1 ? "unique " : "atleast one ") : min + "-" + max) + "matching value from '" + collection.name + "' for query: " + JSON.stringify(query) + ", found " + res.length + " results");
        }
        return res[0];
    }


    // KeyValue store ==========================================
    public getItem(key: string): any {
        if (!key) {
            return;
        }
        key = key.trim().toLowerCase();
        return this.cache[key];
    }


    public setItem(key: string, value: any): void {
        if (!key) {
            return;
        }
        key = key.trim().toLowerCase();
        this.cache[key] = value;
    }


    public removeItem(key: string): void {
        if (!key) {
            return;
        }
        key = key.trim().toLowerCase();
        delete this.cache[key];
    }


    public updateWhere(collectionName: string, query, obj, dstMetaData?: Changes.CollectionChangeTracker) {
        var collection = this._getCollection(collectionName, false);
        return this._updateWhere(collection, query, obj, dstMetaData);
    }


    _updateWhere(collection: LokiCollection<any>, query, obj, dstMetaData?: Changes.CollectionChangeTracker) {
        var self = this;
        var updateProperties = stripMetaData(obj);

        query = self.modelKeys.validateQuery(collection.name, query, updateProperties);

        var results = this._find(collection);

        for (var prop in query) {
            var localQuery = {};
            localQuery[prop] = query[prop];
            results = results.find(localQuery);
        }

        var resData = results.data();

        if (dstMetaData && resData.length > 0) {
            dstMetaData.addChangeItemsModified(resData.length);
        }

        for (var i = 0, size = resData.length; i < size; i++) {
            var doc = resData[i];
            _.assign(doc, updateProperties);
            self._update(collection, doc);
        }
    }


    public addOrUpdateWhere(collectionName: string, query, obj, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker) {
        var collection = this._getCollection(collectionName, false);
        return this._addOrUpdateWhere(collection, query, obj, noModify, dstMetaData);
    }


    _addOrUpdateWhere(collection: LokiCollection<any>, query, obj, noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker) {
        var self = this;

        //remove loki information so not to overwrite it.
        var updateProperties = stripMetaData(obj);
        query = self.modelKeys.validateQuery(collection.name, query, updateProperties);

        var results = this._find(collection);
        for (var prop in query) {
            var localQuery = {};
            localQuery[prop] = query[prop];
            results = results.find(localQuery);
        }

        var compoundDstMetaData = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackersImpl.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }

        var toUpdate = results.data();
        if (toUpdate.length > 0) {
            if (compoundDstMetaData) {
                compoundDstMetaData.addChangeItemsModified(toUpdate.length);
            }

            //update
            for (var i = 0, size = toUpdate.length; i < size; i++) {
                var doc = toUpdate[i];
                _.assign(doc, updateProperties);
                self._update(collection, doc);
            }
        }
        else {
            //Ensure key information is present before inserting
            var toAdd = _.assign(obj, query);
            self._addToCollection(collection, (<any[]>toAdd), noModify, compoundDstMetaData);
        }
    }


    public removeWhere(collectionName: string, query, dstMetaData?: Changes.CollectionChangeTracker) {
        var collection = this._getCollection(collectionName, false);
        return this._removeWhere(collection, query, dstMetaData);
    }


    _removeWhere(collection: LokiCollection<any>, query, dstMetaData?: Changes.CollectionChangeTracker) {
        var docs = this._find(collection, query).data();
        for (var i = 0, size = docs.length; i < size; i++) {
            var doc = docs[i];
            this._remove(collection, doc, dstMetaData);
        }
    }


    public addOrUpdateAll(collectionName: string, keyName: string, updatesArray: any[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker) {
        var collection = this._getCollection(collectionName, false);
        return this._addOrUpdateAll(collection, keyName, updatesArray, noModify, dstMetaData);
    }


    _addOrUpdateAll(collection: LokiCollection<any>, keyName: string, updatesArray: any[], noModify: boolean, dstMetaData?: Changes.CollectionChangeTracker) {
        var existingData = this._find(collection).data();
        var existingDataKeys = _.pluck(existingData, keyName);

        updatesArray = _.cloneDeep(updatesArray).map(stripMetaData);

        var toAdd = updatesArray.filter((update) => {
            return existingDataKeys.indexOf(update[keyName]) === -1;
        });

        var toUpdate = updatesArray.filter((update) => {
            return existingDataKeys.indexOf(update[keyName]) !== -1;
        });

        var compoundDstMetaData = null;
        if (dstMetaData) {
            compoundDstMetaData = new ChangeTrackersImpl.CompoundCollectionChange();
            dstMetaData.addChange(compoundDstMetaData);
        }

        this._addToCollection(collection, toAdd, noModify, compoundDstMetaData);

        if (compoundDstMetaData) {
            compoundDstMetaData.addChangeItemsModified(toUpdate.length);
        }

        for (var i = 0, size = toUpdate.length; i < size; i++) {
            var item = toUpdate[i];
            var query = {};
            query[keyName] = item[keyName];
            this._updateWhere(collection, query, item);
        }
    }


    // Array-like
    public mapReduce(collectionName: string, map: (value, index: number, array: any[]) => any,
            reduce: (previousValue, currentValue, currentIndex: number, array: any[]) => any) {
        var collection = this._getCollection(collectionName);
        if (!collection) {
            return;
        }
        return collection.mapReduce(map, reduce);
    }


    // ==== event loggers ====
    private dataAdded(coll: LokiCollection<any>, newDoc, query, dstMetaData: Changes.CollectionChangeTracker) {
        // events not yet implemented
    }


    private dataModified(coll: LokiCollection<any>, changeDoc, query, dstMetaData: Changes.CollectionChangeTracker) {
        // events not yet implemented
    }


    private dataRemoved(coll: LokiCollection<any>, removedDoc, query, dstMetaData: Changes.CollectionChangeTracker) {
        // events not yet implemented
    }


    // Utility functions =======================
    public stripMetaData(obj: any): any {
        return stripMetaData(obj);
    }


    public static stripMetaData(obj: any): any {
        return stripMetaData(obj);
    }

}

export = InMemDbImpl;
